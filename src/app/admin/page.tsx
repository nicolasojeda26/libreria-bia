"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AccountView from "@/components/admin/AccountView";
import { UnauthorizedError, api, errorMessage } from "@/components/admin/api";
import CategoriesView from "@/components/admin/CategoriesView";
import DashboardView from "@/components/admin/DashboardView";
import ExcelDialog from "@/components/admin/ExcelDialog";
import Login from "@/components/admin/Login";
import ProductEditor, { type EditorDraft } from "@/components/admin/ProductEditor";
import ProductsView from "@/components/admin/ProductsView";
import Shell from "@/components/admin/Shell";
import StoreView from "@/components/admin/StoreView";
import { EMPTY_FILTER, SECTIONS, type ProductFilter, type Section, type StatusFilter } from "@/components/admin/types";
import { Button, FeedbackProvider, useFeedback } from "@/components/admin/ui";
import type { CategoryTree } from "@/lib/categories";
import { urlToPhoto } from "@/lib/image-client";
import type { Product } from "@/types/product";

export default function AdminPage() {
  return (
    <FeedbackProvider>
      <AdminApp />
    </FeedbackProvider>
  );
}

function AdminApp() {
  const { toast } = useFeedback();
  const [status, setStatus] = useState<"loading" | "login" | "error" | "ready">("loading");
  const [user, setUser] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [tree, setTree] = useState<CategoryTree>([]);
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState<Section>("inicio");
  const [filter, setFilter] = useState<ProductFilter>(EMPTY_FILTER);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [importing, setImporting] = useState(false);

  const loadData = useCallback(async () => {
    const [nextProducts, categories, settings] = await Promise.all([
      api<Product[]>("/api/products"),
      api<{ tree: CategoryTree }>("/api/categories"),
      api<{ notice: string }>("/api/settings"),
    ]);
    setProducts(nextProducts);
    setTree(categories.tree);
    setNotice(settings.notice);
  }, []);

  const start = useCallback(
    async (username: string) => {
      setUser(username);
      try {
        await loadData();
        const hash = window.location.hash.slice(1) as Section;
        if (SECTIONS.includes(hash)) setSection(hash);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [loadData],
  );

  useEffect(() => {
    let cancelled = false;
    api<{ username: string }>("/api/auth")
      .then((auth) => {
        if (!cancelled) start(auth.username);
      })
      .catch(() => {
        if (!cancelled) setStatus("login");
      });
    return () => {
      cancelled = true;
    };
  }, [start]);

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof UnauthorizedError) {
        setDraft(null);
        setImporting(false);
        setStatus("login");
      }
      toast(errorMessage(error), "error");
    },
    [toast],
  );

  const reload = useCallback(async () => {
    try {
      await loadData();
    } catch (error) {
      handleError(error);
    }
  }, [loadData, handleError]);

  const navigate = (next: Section) => {
    setSection(next);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0 });
  };

  const showProducts = (patch: Partial<ProductFilter>) => {
    setFilter({ ...EMPTY_FILTER, ...patch });
    navigate("productos");
  };

  const logout = async () => {
    await api("/api/auth", { method: "DELETE" }).catch(() => {});
    setProducts([]);
    setDraft(null);
    setStatus("login");
  };

  const upsertLocal = (product: Product) =>
    setProducts((current) => (current.some((item) => item.id === product.id) ? current.map((item) => (item.id === product.id ? product : item)) : [product, ...current]));
  const removeLocal = (ids: string[]) => setProducts((current) => current.filter((item) => !ids.includes(item.id)));

  const newProduct = () =>
    setDraft({
      mode: "new",
      product: { id: String(Date.now()), name: "", description: "", price: 0, cost: 0, stock: 0, category: section === "productos" ? filter.category : "", image: "" },
    });

  const duplicate = async (product: Product) => {
    let image = product.image;
    if (image.startsWith("/")) {
      // Las fotos subidas pertenecen a un producto: la copia necesita la suya.
      try {
        image = await urlToPhoto(image);
      } catch {
        image = "";
        toast("No se pudo copiar la foto; la copia queda sin foto.", "error");
      }
    }
    setDraft({ mode: "new", product: { ...product, id: String(Date.now()), name: `${product.name} (copia)`, image } });
  };

  const exportExcel = async () => {
    try {
      const { downloadWorkbook } = await import("@/lib/excel");
      downloadWorkbook(products);
      toast("Se descargó el Excel con todos los productos.");
    } catch (error) {
      handleError(error);
    }
  };

  const colorSuggestions = useMemo(() => {
    const names = new Set<string>();
    for (const product of products) for (const item of product.attributes?.[0]?.values ?? []) names.add(item.value);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [products]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Cargando el panel">
        <Loader2 className="size-8 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  if (status === "login") {
    return (
      <Login
        onLogin={(username) => {
          setStatus("loading");
          start(username);
        }}
      />
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-bold">No se pudo cargar el panel</p>
        <p className="max-w-sm text-[15px] text-[#4b5563]">Revisá tu conexión a internet y probá de nuevo.</p>
        <Button
          variant="primary"
          onClick={() => {
            setStatus("loading");
            start(user);
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <Shell section={section} onNavigate={navigate} user={user} productCount={products.length} onLogout={logout}>
      {section === "inicio" && (
        <DashboardView
          user={user}
          products={products}
          tree={tree}
          notice={notice}
          onFilter={(statusFilter: StatusFilter) => showProducts({ status: statusFilter })}
          onNewProduct={newProduct}
          onImport={() => setImporting(true)}
          onEditProduct={(product) => setDraft({ mode: "edit", product })}
          onGoTo={navigate}
        />
      )}

      {section === "productos" && (
        <ProductsView
          products={products}
          tree={tree}
          filter={filter}
          onFilterChange={setFilter}
          onNew={newProduct}
          onEdit={(product) => setDraft({ mode: "edit", product })}
          onDuplicate={duplicate}
          onImport={() => setImporting(true)}
          onExport={exportExcel}
          onSaved={upsertLocal}
          onRemoved={removeLocal}
          onReload={reload}
          onError={handleError}
        />
      )}

      {section === "categorias" && (
        <CategoriesView
          tree={tree}
          products={products}
          onTreeChange={setTree}
          onShowProducts={(category) => showProducts(category === "__sin__" ? { status: "sin-categoria" } : { category })}
          onReload={reload}
          onError={handleError}
        />
      )}

      {section === "tienda" && <StoreView notice={notice} onNoticeChange={setNotice} onError={handleError} />}

      {section === "cuenta" && <AccountView user={user} productCount={products.length} onLogout={logout} onCleared={() => setProducts([])} onError={handleError} />}

      {draft && (
        <ProductEditor
          key={draft.product.id}
          draft={draft}
          tree={tree}
          colorSuggestions={colorSuggestions}
          onClose={() => setDraft(null)}
          onSaved={upsertLocal}
          onRemoved={(id) => removeLocal([id])}
          onError={handleError}
        />
      )}

      {importing && <ExcelDialog productCount={products.length} onClose={() => setImporting(false)} onDone={reload} onError={handleError} />}
    </Shell>
  );
}
