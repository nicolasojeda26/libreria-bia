"use client";

import React, { useState, useEffect, useRef } from "react";
import * as xlsx from "xlsx";
import { unzipSync } from "fflate";
import { 
  Package, Upload, FileSpreadsheet, Save, 
  Trash2, Edit2, Plus, DollarSign, TrendingUp, 
  X, BarChart3, Loader2, Image as ImageIcon, Lock, LogOut, Search, Layers, Images, Settings, Megaphone, KeyRound, ExternalLink
} from "lucide-react";
import { CATEGORY_TREE, categoryLabel } from "@/lib/categories";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  discountPrice?: number;
  stock: number;
  category: string;
  image: string;
};

// Detecta el tipo MIME de una imagen por sus primeros bytes
function detectImageMime(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
  return "image/png";
}

// Convierte bytes a base64 en el navegador
function u8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

// Redimensiona y comprime una imagen (data URL) para que sea liviana
function compressImage(dataUrl: string, maxSize = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Extrae las imágenes incrustadas en un .xlsx y las asigna a cada fila de producto
async function extractImagesFromWorkbook(arrayBuffer: ArrayBuffer, json: Record<string, unknown>[]): Promise<{ json: Record<string, unknown>[]; extracted: number }> {
  try {
    const files = unzipSync(new Uint8Array(arrayBuffer));

    // 1) Archivos de imagen en xl/media/*
    const media: Record<string, Uint8Array> = {};
    Object.entries(files).forEach(([name, data]) => {
      const m = name.match(/xl\/media\/([^/]+)$/);
      if (m) media[m[1]] = data;
    });
    if (Object.keys(media).length === 0) return { json, extracted: 0 };

    const decoder = new TextDecoder();
    const parser = new DOMParser();

    // 2) Relaciones de la primera hoja: rId -> drawing
    const sheetRelPath = "xl/worksheets/_rels/sheet1.xml.rels";
    const sheetRels = files[sheetRelPath];
    if (!sheetRels) return { json, extracted: 0 };

    const relDoc = parser.parseFromString(decoder.decode(sheetRels), "application/xml");
    const drawingTargets: string[] = [];
    relDoc.querySelectorAll("Relationship").forEach((rel) => {
      const target = rel.getAttribute("Target") || "";
      if (target.includes("drawing")) drawingTargets.push(target);
    });

    let extracted = 0;

    for (const target of drawingTargets) {
      const drawingPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      const drawing = files[drawingPath];
      if (!drawing) continue;

      // Relaciones del drawing: rId -> imagen en media
      const drawingRelsPath = drawingPath.replace(/\/drawings\/([^/]+)$/, "/drawings/_rels/$1.rels");
      const drawingRels = files[drawingRelsPath];
      const imgByRel: Record<string, string> = {};
      if (drawingRels) {
        const drelDoc = parser.parseFromString(decoder.decode(drawingRels), "application/xml");
        drelDoc.querySelectorAll("Relationship").forEach((rel) => {
          imgByRel[rel.getAttribute("Id") || ""] = rel.getAttribute("Target") || "";
        });
      }

      const drawDoc = parser.parseFromString(decoder.decode(drawing), "application/xml");

      // 3) Cada ancla (twoCellAnchor / oneCellAnchor) tiene fila/columna + blip con imagen
      const anchors = drawDoc.querySelectorAll("xdr|twoCellAnchor, xdr|oneCellAnchor, xdr|absoluteAnchor");
      for (const anchor of Array.from(anchors)) {
        const from = anchor.querySelector("xdr|from");
        const blip = anchor.querySelector("a|blip");
        if (!from || !blip) continue;

        const rowEl = from.querySelector("xdr|row");
        if (!rowEl) continue;
        const row = parseInt(rowEl.textContent || "0", 10);
        const embed = blip.getAttribute("r:embed") || blip.getAttribute("r:id") || "";

        const imgTarget = imgByRel[embed];
        if (!imgTarget) continue;
        const imgName = imgTarget.split("/").pop() || "";
        const imgData = media[imgName];
        if (!imgData) continue;

        // Fila del Excel (0-based) -> índice en json (restamos la fila de encabezado)
        const jsonIdx = row - 1;
        if (jsonIdx < 0 || jsonIdx >= json.length) continue;

        const currentImage = String(json[jsonIdx].image || "");
        // Solo asignar si no hay URL real o es el placeholder por defecto
        if (!currentImage || currentImage.includes("placeholder")) {
          const mime = detectImageMime(imgData);
          const dataUrl = `data:${mime};base64,${u8ToBase64(imgData)}`;
          json[jsonIdx].image = await compressImage(dataUrl);
          extracted++;
        }
      }
    }

    return { json, extracted };
  } catch {
    // No es un ZIP válido (por ej. .xls antiguo): no hay imágenes para extraer
    return { json, extracted: 0 };
  }
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentUser, setCurrentUser] = useState("");

  const [activeTab, setActiveTab] = useState<'products' | 'finance' | 'categories' | 'settings'>('products');

  // Ajustes: aviso de la tienda y contraseña
  const [notice, setNotice] = useState("");
  const [noticeStatus, setNoticeStatus] = useState("");
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", repeat: "" });
  const [passwordStatus, setPasswordStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string, slug: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 20;

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Product>>({
    id: '', name: '', description: '', price: 0, cost: 0, stock: 0, category: '', image: ''
  });

  // Verify auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setIsAuthenticated(true);
        setCurrentUser(data.username || "");
        fetchProducts();
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setCurrentUser(data.username || usernameInput);
        setPasswordInput("");
        fetchProducts();
      } else {
        setAuthError(data.error || "Usuario o contraseña incorrectos");
      }
    } catch {
      setAuthError("Error al iniciar sesión");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
    setPasswordInput("");
  };

  // Fetch products
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const [resProd, resCat, resSettings] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/settings')
      ]);
      if (resProd.ok) setProducts(await resProd.json());
      if (resCat.ok) setCategories(await resCat.json());
      if (resSettings.ok) setNotice((await resSettings.json()).notice || "");
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotice = async (value: string) => {
    setNoticeStatus("Guardando...");
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notice: value })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      setNotice(data.notice);
      setNoticeStatus(data.notice ? "Aviso publicado en la tienda." : "Aviso quitado de la tienda.");
    } catch (err) {
      setNoticeStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    if (passwordForm.next !== passwordForm.repeat) {
      setPasswordStatus({ ok: false, text: "Las contraseñas nuevas no coinciden." });
      return;
    }
    try {
      const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar la contraseña');
      setPasswordForm({ current: "", next: "", repeat: "" });
      setPasswordStatus({ ok: true, text: "Contraseña actualizada." });
    } catch (err) {
      setPasswordStatus({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  // Image Upload handler for Product Form
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const data = new FormData();
      data.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: data,
      });

      const result = await res.json();
      if (res.ok && result.url) {
        setFormData(prev => ({ ...prev, image: result.url }));
      } else {
        alert('Error al subir la imagen');
      }
    } catch {
      alert('Error de conexión al subir la imagen');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Form handling
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : undefined) : value
    }));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saveUrl = `/api/products/${formData.id || Date.now().toString()}`;

      const res = await fetch(saveUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           ...formData,
           id: formData.id || Date.now().toString()
        }),
      });

      if (!res.ok) throw new Error('Error al guardar el producto');
      
      await fetchProducts();
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ id: '', name: '', description: '', price: 0, cost: 0, stock: 0, category: '', image: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar este producto?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      await fetchProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteAllProducts = async () => {
    if (!confirm('¿Seguro que querés eliminar TODOS los productos del inventario? Esta acción no se puede deshacer.')) return;
    if (!confirm('Última confirmación: se borrarán definitivamente todos los productos y su stock. ¿Continuar?')) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/products', { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al vaciar el inventario');
      await fetchProducts();
      alert('Inventario vaciado correctamente. Ya podés importar un nuevo Excel.');
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({ ...p });
    setIsModalOpen(true);
  };

  const openNewProductModal = () => {
    setEditingProduct(null);
    setFormData({ id: '', name: '', description: '', price: 0, cost: 0, stock: 0, category: '', image: '' });
    setIsModalOpen(true);
  };

  // Excel Logic
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("No data found");
        const arrayBuffer = data as ArrayBuffer;

        // 1) Leer las celdas (nombres, precios, stock, etc.)
        const workbook = xlsx.read(new Uint8Array(arrayBuffer), { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = xlsx.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

        if (json.length === 0) {
          alert("El archivo Excel está vacío.");
          return;
        }

        setIsPublishing(true);

        // 2) Extraer las imágenes incrustadas y asignarlas por fila
        const { json: jsonWithImages, extracted } = await extractImagesFromWorkbook(arrayBuffer, json);

        // 3) Enviar por lotes: el primero borra el stock actual, el resto hace upsert.
        //    Así evitamos el límite de tamaño de la API en archivos grandes.
        const CHUNK_SIZE = 10;
        let sentCount = 0;
        for (let i = 0; i < jsonWithImages.length; i += CHUNK_SIZE) {
          const chunk = jsonWithImages.slice(i, i + CHUNK_SIZE);
          const isFirst = i === 0;
          const res = await fetch(`/api/products${isFirst ? '?replace=1' : ''}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk),
          });

          if (!res.ok) {
            if (res.status === 413) {
              throw new Error('El archivo es demasiado grande. Reducí el tamaño de las fotos en el Excel (máx ~1000px por imagen) y volvé a intentar.');
            }
            throw new Error(`Error al subir el lote ${Math.floor(i / CHUNK_SIZE) + 1} de productos`);
          }
          sentCount += chunk.length;
        }

        await fetchProducts();
        setIsExcelModalOpen(false);
        alert(
          extracted > 0
            ? `¡Importación exitosa! Se cargaron ${sentCount} productos con ${extracted} imágenes desde el Excel.`
            : `¡Importación exitosa! Se cargaron ${sentCount} productos.`
        );
      } catch (err) {
        alert("Error al procesar archivo: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsPublishing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategoryFilter ? p.category === selectedCategoryFilter : true;
    return matchesSearch && matchesCat;
  });

  const knownCategories = new Set(categories.map(c => c.name));
  const uncategorizedCount = products.filter(p => !knownCategories.has(p.category)).length;

  // Finance Calculations
  const totalCapital = products.reduce((sum, p) => sum + (Number(p.cost || 0) * Number(p.stock || 0)), 0);
  const potentialProfit = products.reduce((sum, p) => {
    const salePrice = p.discountPrice ?? p.price;
    return sum + ((Number(salePrice || 0) - Number(p.cost || 0)) * Number(p.stock || 0));
  }, 0);
  const totalInventoryValue = products.reduce((sum, p) => sum + (Number(p.price || 0) * Number(p.stock || 0)), 0);

  // Pagination Logic
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  // Render Login Screen if not authenticated
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-zinc-100 text-zinc-900 rounded-xl flex items-center justify-center mx-auto border border-zinc-200">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900">Panel de Control</h1>
            <p className="text-xs text-zinc-500">Ingresá con tu usuario y contraseña para administrar la tienda</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block text-xs font-medium text-zinc-700">
              Usuario
              <input
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="mt-1 w-full px-4 py-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none text-base"
                autoFocus
              />
            </label>
            <label className="block text-xs font-medium text-zinc-700">
              Contraseña
              <input
                type="password"
                required
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="mt-1 w-full px-4 py-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none text-base"
              />
            </label>

            {authError && (
              <p className="text-xs text-red-600 text-center font-medium bg-red-50 p-2.5 rounded-lg border border-red-100">{authError}</p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm disabled:opacity-60"
            >
              {isLoggingIn ? 'Ingresando...' : 'Ingresar al Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Admin */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-zinc-900 text-white rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">Gestión de Inventario</h1>
              <p className="text-zinc-500 text-xs">Administra tus productos, precios y datos financieros</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-3.5 py-1.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 ${activeTab === 'products' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                <Package className="w-3.5 h-3.5" /> Productos ({products.length})
              </button>
              <button
                onClick={() => setActiveTab('finance')}
                className={`px-3.5 py-1.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 ${activeTab === 'finance' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Finanzas
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-3.5 py-1.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 ${activeTab === 'categories' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                <Layers className="w-3.5 h-3.5" /> Categorías
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3.5 py-1.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 ${activeTab === 'settings' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                <Settings className="w-3.5 h-3.5" /> Ajustes
              </button>
            </div>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ver tienda
            </a>

            <button
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
          </div>
        ) : (
          <>
            {/* INVENTORY TAB */}
            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-zinc-200">
                  <div className="flex flex-1 gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre o ID..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="pl-9 pr-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none text-xs w-full"
                      />
                    </div>
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => { setSelectedCategoryFilter(e.target.value); setCurrentPage(1); }}
                      className="px-3 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none text-xs"
                    >
                      <option value="">Todas las Categorías</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setIsExcelModalOpen(true)}
                      className="flex items-center px-3.5 py-2 bg-zinc-100 text-zinc-800 rounded-lg hover:bg-zinc-200 transition-colors font-medium text-xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Importar Excel
                    </button>
                    <button
                      onClick={openNewProductModal}
                      className="flex items-center px-3.5 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Crear Producto
                    </button>
                    {products.length > 0 && (
                      <button
                        onClick={handleDeleteAllProducts}
                        className="flex items-center px-3.5 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-xs border border-red-100"
                        title="Elimina todos los productos del inventario"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Vaciar Inventario
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[11px] text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200">
                        <tr>
                          <th className="px-5 py-3">Producto</th>
                          <th className="px-5 py-3">Categoría</th>
                          <th className="px-5 py-3">Precio Venta</th>
                          <th className="px-5 py-3">Costo</th>
                          <th className="px-5 py-3">Stock</th>
                          <th className="px-5 py-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {currentProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                {p.image && !p.image.includes("via.placeholder.com") ? (
                                  <img src={p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-zinc-200 shrink-0" />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200 shrink-0">
                                    <ImageIcon className="w-4 h-4 text-zinc-400" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-zinc-900">{p.name}</div>
                                  <div className="text-[10px] text-zinc-400">ID: {p.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-zinc-600">{p.category || '-'}</td>
                            <td className="px-5 py-3">
                              <div className="font-semibold text-zinc-900">${(p.price || 0).toLocaleString('es-AR')}</div>
                              {p.discountPrice != null && <div className="text-[10px] text-emerald-600 font-medium">Oferta: ${(p.discountPrice).toLocaleString('es-AR')}</div>}
                            </td>
                            <td className="px-5 py-3 text-zinc-500">${(p.cost || 0).toLocaleString('es-AR')}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.stock > 10 ? 'bg-emerald-50 text-emerald-700' : p.stock > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                                {p.stock} un.
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <button onClick={() => openEditModal(p)} className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredProducts.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 text-xs">
                              No hay productos registrados. Sube una planilla Excel o crea uno manualmente.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="p-3 border-t border-zinc-200 flex items-center justify-between bg-zinc-50 text-xs">
                      <span className="text-zinc-500 text-[11px]">
                        Mostrando {indexOfFirstProduct + 1} - {Math.min(indexOfLastProduct, filteredProducts.length)} de {filteredProducts.length}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={handlePrevPage}
                          disabled={currentPage === 1}
                          className="px-2.5 py-1 rounded-md bg-white border border-zinc-200 text-xs font-medium text-zinc-700 disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <span className="px-2 py-1 text-xs text-zinc-600 font-medium">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={handleNextPage}
                          disabled={currentPage === totalPages}
                          className="px-2.5 py-1 rounded-md bg-white border border-zinc-200 text-xs font-medium text-zinc-700 disabled:opacity-50"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FINANCE TAB */}
            {activeTab === 'finance' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2.5 bg-[#faf8f6] text-[#e8572f] rounded-lg">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-medium text-zinc-500">Capital Invertido</h3>
                        <p className="text-xl font-bold text-zinc-900">${totalCapital.toLocaleString('es-AR')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-medium text-zinc-500">Ganancia Estimada</h3>
                        <p className="text-xl font-bold text-zinc-900">${potentialProfit.toLocaleString('es-AR')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-medium text-zinc-500">Valor Total Venta</h3>
                        <p className="text-xl font-bold text-zinc-900">${totalInventoryValue.toLocaleString('es-AR')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CATEGORIES TAB */}
            {activeTab === 'categories' && (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200">
                  <h2 className="text-sm font-semibold text-zinc-900">Árbol de categorías</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Es el mismo menú que ve el cliente en la tienda. Para mover un producto de categoría, editalo desde la pestaña Productos.
                  </p>
                  {uncategorizedCount > 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5 mt-3">
                      Hay {uncategorizedCount} {uncategorizedCount === 1 ? 'producto' : 'productos'} con una categoría que no está en el árbol: no aparecen en ninguna categoría del menú (sí en “Todos los productos” y en el buscador).
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-5 py-3">Categoría</th>
                        <th className="px-5 py-3 text-right">Productos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {CATEGORY_TREE.map((parent) => (
                        <React.Fragment key={parent.slug}>
                          <tr className="bg-zinc-50/60">
                            <td className="px-5 py-3 font-semibold text-zinc-900">{parent.name}</td>
                            <td className="px-5 py-3 text-right font-semibold text-zinc-900">
                              {products.filter(p => p.category === parent.name || p.category.startsWith(`${parent.name} > `)).length}
                            </td>
                          </tr>
                          {parent.children.map((child) => {
                            const label = categoryLabel({ parent, child });
                            return (
                              <tr key={child.slug} className="hover:bg-zinc-50">
                                <td className="px-5 py-2.5 pl-10 text-zinc-600">{child.name}</td>
                                <td className="px-5 py-2.5 text-right text-zinc-600">{products.filter(p => p.category === label).length}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-200 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-zinc-100 text-zinc-900 rounded-lg"><Megaphone className="w-5 h-5" /></div>
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">Aviso de la tienda</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Aparece arriba de todo en la tienda, debajo de la bienvenida. Sirve para avisos del día, por ejemplo: “Mañana hago entregas en el Campus Roca”.
                      </p>
                    </div>
                  </div>
                  <textarea
                    value={notice}
                    onChange={(e) => { setNotice(e.target.value); setNoticeStatus(""); }}
                    maxLength={160}
                    rows={3}
                    placeholder="Escribí el aviso (dejalo vacío para no mostrar nada)"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900 text-sm"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => handleSaveNotice(notice)} className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 font-medium text-xs flex items-center gap-1.5">
                      <Save className="w-3.5 h-3.5" /> Publicar aviso
                    </button>
                    <button onClick={() => handleSaveNotice("")} className="px-3.5 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg font-medium text-xs">
                      Quitar aviso
                    </button>
                    <span className="text-[11px] text-zinc-400 ml-auto">{notice.length}/160</span>
                  </div>
                  {noticeStatus && <p className="text-xs text-zinc-600" role="status">{noticeStatus}</p>}
                </div>

                <form onSubmit={handleChangePassword} className="bg-white p-5 rounded-xl shadow-sm border border-zinc-200 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-zinc-100 text-zinc-900 rounded-lg"><KeyRound className="w-5 h-5" /></div>
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">Cambiar contraseña</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">Usuario: <span className="font-semibold text-zinc-700">{currentUser}</span>. Mínimo 8 caracteres.</p>
                    </div>
                  </div>
                  <label className="block text-xs font-medium text-zinc-700">
                    Contraseña actual
                    <input type="password" required autoComplete="current-password" value={passwordForm.current} onChange={(e) => setPasswordForm(f => ({ ...f, current: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900 text-sm" />
                  </label>
                  <label className="block text-xs font-medium text-zinc-700">
                    Contraseña nueva
                    <input type="password" required minLength={8} autoComplete="new-password" value={passwordForm.next} onChange={(e) => setPasswordForm(f => ({ ...f, next: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900 text-sm" />
                  </label>
                  <label className="block text-xs font-medium text-zinc-700">
                    Repetir contraseña nueva
                    <input type="password" required minLength={8} autoComplete="new-password" value={passwordForm.repeat} onChange={(e) => setPasswordForm(f => ({ ...f, repeat: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900 text-sm" />
                  </label>
                  <button type="submit" className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 font-medium text-xs flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Guardar contraseña
                  </button>
                  {passwordStatus && (
                    <p className={`text-xs p-2.5 rounded-lg border ${passwordStatus.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`} role="status">{passwordStatus.text}</p>
                  )}
                </form>
              </div>
            )}
          </>
        )}
      </div>

      {/* PRODUCT MODAL EDIT / NEW */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-zinc-200">
              <h2 className="text-base font-bold text-zinc-900">{editingProduct ? 'Editar Producto' : 'Crear Producto'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Código / ID</label>
                  <input required name="id" value={formData.id} onChange={handleInputChange} disabled={!!editingProduct} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none disabled:bg-zinc-100 text-xs" />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Nombre</label>
                  <input required name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none text-xs" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block font-medium text-zinc-700 mb-1">Descripción</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none text-xs" />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Categoría</label>
                  <select name="category" value={formData.category} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none text-xs">
                    <option value="">Sin Categoría</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Stock (Unidades)</label>
                  <input type="number" required name="stock" value={formData.stock} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none text-xs" />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Costo ($)</label>
                  <input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none text-xs" />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Precio Venta ($)</label>
                  <input type="number" step="0.01" required name="price" value={formData.price} onChange={handleInputChange} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none text-xs" />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-medium text-zinc-700 mb-1">Imagen (URL o archivo local)</label>
                  <div className="flex gap-2 mb-2">
                    <input 
                      name="image" 
                      value={formData.image} 
                      onChange={handleInputChange} 
                      placeholder="URL o sube una foto de tu PC" 
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none text-xs" 
                    />
                    <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-3 py-2 rounded-lg font-medium text-xs flex items-center shrink-0 border border-zinc-200">
                      <Upload className="w-3.5 h-3.5 mr-1" /> Subir
                      <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                    </label>
                  </div>

                  {isUploadingImage && <p className="text-[11px] text-zinc-500">Subiendo archivo de imagen...</p>}

                  {formData.image && (
                    <div className="mt-2 flex justify-center bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                      <img src={formData.image} alt="Preview" className="h-28 object-contain" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3.5 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg font-medium text-xs">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 font-medium text-xs flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL UPLOAD MODAL */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-zinc-200">
              <h2 className="text-base font-bold text-zinc-900">Importar Excel de Productos</h2>
              <button onClick={() => setIsExcelModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div 
                className="border-2 border-dashed border-zinc-300 rounded-2xl p-8 text-center hover:border-zinc-800 hover:bg-zinc-50 cursor-pointer transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
                <FileSpreadsheet className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
                <p className="font-semibold text-zinc-800 text-xs mb-1">Selecciona tu archivo de Excel</p>
                <p className="text-[11px] text-zinc-400">Soporta formatos .xlsx, .xls y .csv</p>
              </div>

              <div className="mt-4 p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                <p className="text-[11px] text-zinc-500 flex items-start gap-1.5">
                  <Images className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-semibold text-zinc-700">Importante:</span> si tu Excel tiene fotos pegadas en las celdas (formato .xlsx), se extraen automáticamente y se asignan a cada producto. También acepta una columna con URLs de imágenes (Imagen, Foto, URL).
                  </span>
                </p>
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  Columnas reconocidas: Código, Producto, Descripción, Precio, Costo, Oferta, Stock, Categoría e Imagen (en español o inglés).
                </p>
              </div>

              {isPublishing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-zinc-800 text-xs font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" /> Procesando planilla e importando datos...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
