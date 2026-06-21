"use client";

import { supabase } from "@/lib/supabase";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type ProductRow = {
  id: string;
  code: string;
  name: string;
  jodai: number;
  genka: number;
  stock: number;
  location: string | null;
  unit: string | null;
  notes: string | null;
  image_url: string | null;
};

type Product = {
  id: string;
  code: string;
  name: string;
  stock: number;
  retailPrice: number;
  costPrice: number;
  location: string;
  unit: string;
  notes: string;
  imageUrl: string;
  imageColor: string;
};

type ProductForm = {
  name: string;
  jodai: string;
  genka: string;
  stock: string;
  location: string;
  unit: string;
  notes: string;
};

type StockMode = "in" | "out";

type StockForm = {
  quantity: string;
  userName: string;
  memo: string;
};

type TransactionRow = {
  id: string;
  product_id: string;
  type: string | null;
  qty: number | null;
  transaction_type: string | null;
  quantity: number | null;
  user_name: string | null;
  memo: string | null;
  created_at: string;
  products:
    | {
        code: string | null;
        name: string | null;
      }
    | {
        code: string | null;
        name: string | null;
      }[]
    | null;
};

type StockTransaction = {
  id: string;
  productCode: string;
  productName: string;
  mode: StockMode;
  quantity: number;
  userName: string;
  memo: string;
  createdAt: string;
};

const IMAGE_COLORS = [
  "from-blue-100 to-blue-200",
  "from-sky-100 to-blue-300",
  "from-indigo-100 to-blue-200",
  "from-cyan-100 to-blue-200",
  "from-violet-100 to-blue-200",
];

const EMPTY_FORM: ProductForm = {
  name: "",
  jodai: "",
  genka: "",
  stock: "",
  location: "",
  unit: "",
  notes: "",
};

const EMPTY_STOCK_FORM: StockForm = {
  quantity: "",
  userName: "管理者",
  memo: "",
};

function formatNumber(value: number) {
  return value.toLocaleString("ja-JP");
}

function formatCurrency(value: number) {
  return `¥${formatNumber(value)}`;
}


function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("画像処理に失敗しました。"));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };

      image.onerror = () => reject(new Error("画像を読み込めませんでした。"));
      image.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error("画像ファイルを読み込めませんでした。"));
    reader.readAsDataURL(file);
  });
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toTransaction(row: TransactionRow): StockTransaction {
  const mode = (row.transaction_type ?? row.type) === "out" ? "out" : "in";
  const productInfo = Array.isArray(row.products)
    ? row.products[0]
    : row.products;

  return {
    id: row.id,
    productCode: productInfo?.code ?? "",
    productName: productInfo?.name ?? "",
    mode,
    quantity: row.quantity ?? row.qty ?? 0,
    userName: row.user_name ?? "",
    memo: row.memo ?? "",
    createdAt: row.created_at,
  };
}

function toProduct(row: ProductRow, index: number): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    stock: row.stock,
    retailPrice: row.jodai,
    costPrice: row.genka,
    location: row.location ?? "",
    unit: row.unit ?? "",
    notes: row.notes ?? "",
    imageUrl: row.image_url ?? "",
    imageColor: IMAGE_COLORS[index % IMAGE_COLORS.length],
  };
}

async function generateNextCode(): Promise<string> {
  const { data, error } = await supabase
    .from("products")
    .select("code")
    .like("code", "P%")
    .order("code", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) {
    return "P0001";
  }

  const lastCode = data[0].code as string;
  const match = lastCode.match(/^P(\d+)$/);
  const nextNumber = match ? Number.parseInt(match[1], 10) + 1 : 1;

  return `P${String(nextNumber).padStart(4, "0")}`;
}

function ProductImage({ color, imageUrl }: { color: string; imageUrl?: string }) {
  return (
    <div
      className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${color} shadow-inner sm:h-20 sm:w-20`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="商品画像" className="h-full w-full object-cover" />
      ) : (
      <svg
        className="h-8 w-8 text-blue-500/70 sm:h-10 sm:w-10"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
        />
      </svg>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm shadow-blue-100/50 transition-shadow hover:shadow-md sm:p-5">
      <p className="text-xs font-medium tracking-wide text-blue-600/80 sm:text-sm">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-blue-900 sm:text-3xl">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-medium text-blue-600/70 sm:text-base">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

function StockButtons({
  product,
  onStockAction,
}: {
  product: Product;
  onStockAction: (product: Product, mode: StockMode) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onStockAction(product, "in")}
        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        入庫
      </button>
      <button
        type="button"
        onClick={() => onStockAction(product, "out")}
        className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-600"
      >
        出庫
      </button>
    </div>
  );
}

function ProductCard({
  product,
  onStockAction,
  onEdit,
  onDelete,
}: {
  product: Product;
  onStockAction: (product: Product, mode: StockMode) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  const costInventory = product.stock * product.costPrice;
  const retailValue = product.stock * product.retailPrice;

  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm shadow-blue-100/40 lg:hidden">
      <div className="flex gap-4">
        <ProductImage color={product.imageColor} imageUrl={product.imageUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-blue-600">{product.code}</p>
          <h3 className="mt-0.5 truncate text-base font-bold text-slate-800">
            {product.name}
          </h3>
          <p className="mt-2 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            在庫 {formatNumber(product.stock)}
            {product.unit ? ` ${product.unit}` : " 点"}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">上代</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-800">
            {formatCurrency(product.retailPrice)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">原価</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-800">
            {formatCurrency(product.costPrice)}
          </dd>
        </div>
        {product.location && (
          <div>
            <dt className="text-xs text-slate-500">保管場所</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {product.location}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-slate-500">原価在庫金額</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-blue-800">
            {formatCurrency(costInventory)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">上代評価額</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-blue-800">
            {formatCurrency(retailValue)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
        >
          編集
        </button>
        <StockButtons product={product} onStockAction={onStockAction} />
        <button
          type="button"
          onClick={() => onDelete(product)}
          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50"
        >
          削除
        </button>
      </div>
    </article>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stockMode, setStockMode] = useState<StockMode | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockForm, setStockForm] = useState<StockForm>(EMPTY_STOCK_FORM);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>(EMPTY_FORM);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("products")
      .select("id, code, name, jodai, genka, stock, location, unit, notes, image_url")
      .order("code", { ascending: true });

    if (fetchError) {
      setError(`商品一覧の取得に失敗しました: ${fetchError.message}`);
      setProducts([]);
      return;
    }

    setProducts(
      (data as ProductRow[]).map((row, index) => toProduct(row, index)),
    );
  }, []);


  const fetchTransactions = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("stock_transactions")
      .select(
        "id, product_id, type, qty, transaction_type, quantity, user_name, memo, created_at, products(code, name)",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      setError(`入出庫履歴の取得に失敗しました: ${fetchError.message}`);
      setTransactions([]);
      return;
    }

    setTransactions((data as TransactionRow[]).map(toTransaction));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setHistoryLoading(true);
      await Promise.all([fetchProducts(), fetchTransactions()]);
      if (!cancelled) {
        setLoading(false);
        setHistoryLoading(false);
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [fetchProducts, fetchTransactions]);

  const stats = useMemo(() => {
    const productCount = products.length;
    const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
    const totalCost = products.reduce(
      (sum, product) => sum + product.stock * product.costPrice,
      0,
    );
    const totalRetailValue = products.reduce(
      (sum, product) => sum + product.stock * product.retailPrice,
      0,
    );

    return { productCount, totalStock, totalCost, totalRetailValue };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;

    return products.filter(
      (product) =>
        product.code.toLowerCase().includes(normalized) ||
        product.name.toLowerCase().includes(normalized),
    );
  }, [products, query]);

  function updateForm(field: keyof ProductForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditForm(field: keyof ProductForm, value: string) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  function openEditDialog(product: Product) {
    setError(null);
    setSuccess(null);
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      jodai: String(product.retailPrice),
      genka: String(product.costPrice),
      stock: String(product.stock),
      location: product.location,
      unit: product.unit,
      notes: product.notes,
    });
    setEditImageFile(null);
    setEditImagePreview(product.imageUrl || null);
  }

  function closeEditDialog() {
    if (editSubmitting) return;
    setEditingProduct(null);
    setEditForm(EMPTY_FORM);
    setEditImageFile(null);
    setEditImagePreview(null);
  }

  async function handleDeleteProduct(product: Product) {
    const ok = window.confirm(
      `${product.code} ${product.name} を削除しますか？\n入出庫履歴も削除されます。`
    );

    if (!ok) return;

    setError(null);
    setSuccess(null);
    setDeletingProductId(product.id);

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (deleteError) {
      setError(`商品の削除に失敗しました: ${deleteError.message}`);
      setDeletingProductId(null);
      return;
    }

    await Promise.all([fetchProducts(), fetchTransactions()]);
    setSuccess(`${product.code} を削除しました。`);
    setDeletingProductId(null);
  }

  async function handleEditImageChange(file: File | null) {
    setEditImageFile(file);
    setError(null);

    if (!file) {
      setEditImagePreview(editingProduct?.imageUrl || null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください。");
      setEditImageFile(null);
      setEditImagePreview(editingProduct?.imageUrl || null);
      return;
    }

    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setEditImagePreview(dataUrl);
    } catch (imageError) {
      const message =
        imageError instanceof Error ? imageError.message : "画像処理に失敗しました。";
      setError(message);
      setEditImageFile(null);
      setEditImagePreview(editingProduct?.imageUrl || null);
    }
  }


  async function handleImageChange(file: File | null) {
    setImageFile(file);
    setError(null);

    if (!file) {
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください。");
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImagePreview(dataUrl);
    } catch (imageError) {
      const message = imageError instanceof Error ? imageError.message : "画像処理に失敗しました。";
      setError(message);
      setImageFile(null);
      setImagePreview(null);
    }
  }

  function updateStockForm(field: keyof StockForm, value: string) {
    setStockForm((current) => ({ ...current, [field]: value }));
  }

  function openStockDialog(product: Product, mode: StockMode) {
    setError(null);
    setSuccess(null);
    setSelectedProduct(product);
    setStockMode(mode);
    setStockForm({
      quantity: "",
      userName: "管理者",
      memo: mode === "in" ? "入庫" : "出庫",
    });
  }

  function closeStockDialog() {
    if (stockSubmitting) return;
    setSelectedProduct(null);
    setStockMode(null);
    setStockForm(EMPTY_STOCK_FORM);
  }


  function escapeCsvValue(value: string | number) {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
      return `"${text.replaceAll("\"", '""')}"`;
    }
    return text;
  }

  function handleExportCsv() {
    if (products.length === 0) {
      setError("出力する商品がありません。");
      setSuccess(null);
      return;
    }

    const headers = [
      "品番",
      "商品名",
      "在庫数",
      "単位",
      "上代",
      "原価",
      "保管場所",
      "備考",
      "原価在庫金額",
      "上代評価額",
    ];

    const rows = products.map((product) => [
      product.code,
      product.name,
      product.stock,
      product.unit,
      product.retailPrice,
      product.costPrice,
      product.location,
      product.notes,
      product.stock * product.costPrice,
      product.stock * product.retailPrice,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");

    const bom = "\ufeff";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `products_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setError(null);
    setSuccess("CSVを出力しました。");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const name = form.name.trim();
    if (!name) {
      setError("商品名を入力してください。");
      return;
    }

    const jodai = Number(form.jodai);
    const genka = Number(form.genka);
    const stock = Number(form.stock);

    if (Number.isNaN(jodai) || jodai < 0) {
      setError("上代は0以上の数値で入力してください。");
      return;
    }

    if (Number.isNaN(genka) || genka < 0) {
      setError("原価は0以上の数値で入力してください。");
      return;
    }

    if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      setError("在庫数は0以上の整数で入力してください。");
      return;
    }

    setSubmitting(true);

    try {
      const code = await generateNextCode();
      const imageUrl = imageFile ? await resizeImageToDataUrl(imageFile) : null;

      const { error: insertError } = await supabase.from("products").insert({
        code,
        name,
        jodai,
        genka,
        stock,
        location: form.location.trim() || null,
        unit: form.unit.trim() || null,
        notes: form.notes.trim() || null,
        image_url: imageUrl,
      });

      if (insertError) {
        setError(`商品の登録に失敗しました: ${insertError.message}`);
        return;
      }

      await fetchProducts();
      setForm(EMPTY_FORM);
      setImageFile(null);
      setImagePreview(null);
      setSuccess(`${code} を登録しました。`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "不明なエラーが発生しました。";
      setError(`商品の登録に失敗しました: ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!editingProduct) {
      setError("編集する商品が選択されていません。");
      return;
    }

    const name = editForm.name.trim();
    if (!name) {
      setError("商品名を入力してください。");
      return;
    }

    const jodai = Number(editForm.jodai);
    const genka = Number(editForm.genka);
    const stock = Number(editForm.stock);

    if (Number.isNaN(jodai) || jodai < 0) {
      setError("上代は0以上の数値で入力してください。");
      return;
    }

    if (Number.isNaN(genka) || genka < 0) {
      setError("原価は0以上の数値で入力してください。");
      return;
    }

    if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      setError("在庫数は0以上の整数で入力してください。");
      return;
    }

    setEditSubmitting(true);

    try {
      const imageUrl = editImageFile
        ? await resizeImageToDataUrl(editImageFile)
        : editImagePreview || null;

      const { error: updateError } = await supabase
        .from("products")
        .update({
          name,
          jodai,
          genka,
          stock,
          location: editForm.location.trim() || null,
          unit: editForm.unit.trim() || null,
          notes: editForm.notes.trim() || null,
          image_url: imageUrl,
        })
        .eq("id", editingProduct.id);

      if (updateError) {
        setError(`商品の更新に失敗しました: ${updateError.message}`);
        return;
      }

      await fetchProducts();
      setSuccess(`${editingProduct.code} を更新しました。`);
      closeEditDialog();
    } catch (editError) {
      const message =
        editError instanceof Error ? editError.message : "不明なエラーが発生しました。";
      setError(`商品の更新に失敗しました: ${message}`);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleStockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedProduct || !stockMode) {
      setError("商品が選択されていません。");
      return;
    }

    const quantity = Number(stockForm.quantity);
    if (Number.isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      setError("数量は1以上の整数で入力してください。");
      return;
    }

    const nextStock =
      stockMode === "in"
        ? selectedProduct.stock + quantity
        : selectedProduct.stock - quantity;

    if (nextStock < 0) {
      setError("在庫数が不足しています。出庫数量を確認してください。");
      return;
    }

    setStockSubmitting(true);

    try {
      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: nextStock })
        .eq("id", selectedProduct.id);

      if (updateError) {
        setError(`在庫数の更新に失敗しました: ${updateError.message}`);
        return;
      }

      const { error: historyError } = await supabase
        .from("stock_transactions")
        .insert({
          product_id: selectedProduct.id,
          type: stockMode,
          qty: quantity,
          transaction_type: stockMode,
          quantity,
          user_name: stockForm.userName.trim() || "管理者",
          memo: stockForm.memo.trim() || null,
        });

      if (historyError) {
        setError(`履歴保存に失敗しました: ${historyError.message}`);
        return;
      }

      await Promise.all([fetchProducts(), fetchTransactions()]);
      setSuccess(
        `${selectedProduct.code} ${selectedProduct.name} を${
          stockMode === "in" ? "入庫" : "出庫"
        }しました。`,
      );
      closeStockDialog();
    } catch (stockError) {
      const message =
        stockError instanceof Error
          ? stockError.message
          : "不明なエラーが発生しました。";
      setError(`入出庫処理に失敗しました: ${message}`);
    } finally {
      setStockSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50">
      <header className="border-b border-blue-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-blue-950 sm:text-xl">
                在庫管理
              </h1>
              <p className="text-xs text-slate-500 sm:text-sm">
                Inventory Dashboard
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {(error || success) && (
          <div className="mb-6 space-y-3" aria-live="polite">
            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            )}
          </div>
        )}

       <section className="mt-6 sm:mt-8" aria-label="商品検索">
          <label htmlFor="search" className="sr-only">
            商品を検索
          </label>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              id="search"
              type="search"
              placeholder="品番・商品名で検索..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-2xl border border-blue-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-800 shadow-sm shadow-blue-100/50 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:text-base"
            />
          </div>
        </section>
 <section aria-label="サマリー">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="商品数"
              value={formatNumber(stats.productCount)}
              unit="件"
            />
            <StatCard
              label="総在庫数"
              value={formatNumber(stats.totalStock)}
              unit="点"
            />
            <StatCard
              label="原価総額"
              value={formatCurrency(stats.totalCost)}
            />
            <StatCard
              label="上代評価額"
              value={formatCurrency(stats.totalRetailValue)}
            />
          </div>
        </section>

        <section className="mt-6 sm:mt-8" aria-label="商品登録">
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm shadow-blue-100/40 sm:p-6">
            <h2 className="text-base font-bold text-blue-950 sm:text-lg">
              商品登録
            </h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              品番は P0001 形式で自動採番されます
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  商品名 <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="例: オーガニックコットンTシャツ"
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  商品画像
                </span>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleImageChange(event.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="商品画像プレビュー"
                      className="h-24 w-24 rounded-xl border border-blue-100 object-cover"
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  iPhoneではカメラ撮影・写真選択ができます。
                </p>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  上代 <span className="text-red-500">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.jodai}
                  onChange={(event) => updateForm("jodai", event.target.value)}
                  placeholder="3980"
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  原価 <span className="text-red-500">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.genka}
                  onChange={(event) => updateForm("genka", event.target.value)}
                  placeholder="1850"
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  在庫数 <span className="text-red-500">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(event) => updateForm("stock", event.target.value)}
                  placeholder="120"
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  保管場所
                </span>
                <input
                  type="text"
                  value={form.location}
                  onChange={(event) =>
                    updateForm("location", event.target.value)
                  }
                  placeholder="例: 倉庫A-1"
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  単位
                </span>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(event) => updateForm("unit", event.target.value)}
                  placeholder="例: 個、箱、kg"
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  備考
                </span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="メモや補足情報"
                  rows={3}
                  className="w-full resize-y rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="sm:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "登録中..." : "商品を登録"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <a
  href="#product-list"
  className="block rounded-xl bg-blue-600 text-white text-center py-3 mt-3"
>
  商品一覧へ
</a>
        <section
  id="product-list"
  className="mt-6 sm:mt-8"
  aria-label="商品一覧"
>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-blue-950 sm:text-lg">
                商品一覧
              </h2>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                {filteredProducts.length} 件
              </span>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              CSV出力
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-blue-100 bg-white px-6 py-12 text-center">
              <p className="text-sm text-slate-500">読み込み中...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-blue-200 bg-white px-6 py-12 text-center">
              <p className="text-sm text-slate-500">
                {products.length === 0
                  ? "登録された商品がありません"
                  : "該当する商品が見つかりませんでした"}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onStockAction={openStockDialog}
                    onEdit={openEditDialog}
                    onDelete={handleDeleteProduct}
                  />
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm shadow-blue-100/40 lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1200px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-blue-100 bg-blue-50/80">
                        <th className="px-5 py-4 font-semibold text-blue-900">
                          商品画像
                        </th>
                        <th className="px-5 py-4 font-semibold text-blue-900">
                          品番
                        </th>
                        <th className="px-5 py-4 font-semibold text-blue-900">
                          商品名
                        </th>
                        <th className="px-5 py-4 text-right font-semibold text-blue-900">
                          在庫数
                        </th>
                        <th className="px-5 py-4 font-semibold text-blue-900">
                          保管場所
                        </th>
                        <th className="px-5 py-4 font-semibold text-blue-900">
                          単位
                        </th>
                        <th className="px-5 py-4 text-right font-semibold text-blue-900">
                          上代
                        </th>
                        <th className="px-5 py-4 text-right font-semibold text-blue-900">
                          原価
                        </th>
                        <th className="px-5 py-4 text-right font-semibold text-blue-900">
                          原価在庫金額
                        </th>
                        <th className="px-5 py-4 text-right font-semibold text-blue-900">
                          上代評価額
                        </th>
                        <th className="px-5 py-4 font-semibold text-blue-900">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {filteredProducts.map((product) => {
                        const costInventory =
                          product.stock * product.costPrice;
                        const retailValue =
                          product.stock * product.retailPrice;

                        return (
                          <tr
                            key={product.id}
                            className="transition-colors hover:bg-blue-50/40"
                          >
                            <td className="px-5 py-4">
                              <ProductImage color={product.imageColor} imageUrl={product.imageUrl} />
                            </td>
                            <td className="px-5 py-4 font-medium text-blue-700">
                              {product.code}
                            </td>
                            <td className="px-5 py-4 font-medium text-slate-800">
                              {product.name}
                            </td>
                            <td className="px-5 py-4 text-right tabular-nums text-slate-700">
                              {formatNumber(product.stock)}
                            </td>
                            <td className="px-5 py-4 text-slate-700">
                              {product.location || "—"}
                            </td>
                            <td className="px-5 py-4 text-slate-700">
                              {product.unit || "—"}
                            </td>
                            <td className="px-5 py-4 text-right tabular-nums text-slate-700">
                              {formatCurrency(product.retailPrice)}
                            </td>
                            <td className="px-5 py-4 text-right tabular-nums text-slate-700">
                              {formatCurrency(product.costPrice)}
                            </td>
                            <td className="px-5 py-4 text-right tabular-nums font-medium text-blue-800">
                              {formatCurrency(costInventory)}
                            </td>
                            <td className="px-5 py-4 text-right tabular-nums font-medium text-blue-800">
                              {formatCurrency(retailValue)}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditDialog(product)}
                                  className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
                                >
                                  編集
                                </button>
                                <StockButtons
                                  product={product}
                                  onStockAction={openStockDialog}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(product)}
                                  disabled={deletingProductId === product.id}
                                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {deletingProductId === product.id ? "削除中" : "削除"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="mt-6 sm:mt-8" aria-label="入出庫履歴">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-blue-950 sm:text-lg">
              入出庫履歴
            </h2>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
              最新 {transactions.length} 件
            </span>
          </div>

          {historyLoading ? (
            <div className="rounded-2xl border border-blue-100 bg-white px-6 py-10 text-center">
              <p className="text-sm text-slate-500">履歴を読み込み中...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-blue-200 bg-white px-6 py-10 text-center">
              <p className="text-sm text-slate-500">入出庫履歴はまだありません</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm shadow-blue-100/40">
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-blue-50/95">
                    <tr className="border-b border-blue-100">
                      <th className="px-4 py-3 font-semibold text-blue-900">日時</th>
                      <th className="px-4 py-3 font-semibold text-blue-900">品番</th>
                      <th className="px-4 py-3 font-semibold text-blue-900">商品名</th>
                      <th className="px-4 py-3 font-semibold text-blue-900">区分</th>
                      <th className="px-4 py-3 text-right font-semibold text-blue-900">数量</th>
                      <th className="px-4 py-3 font-semibold text-blue-900">担当者</th>
                      <th className="px-4 py-3 font-semibold text-blue-900">備考</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-blue-50/40">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDateTime(transaction.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-blue-700">
                          {transaction.productCode || "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {transaction.productName || "削除済み商品"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              transaction.mode === "in"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {transaction.mode === "in" ? "入庫" : "出庫"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">
                          {transaction.mode === "in" ? "+" : "-"}
                          {formatNumber(transaction.quantity)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {transaction.userName || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {transaction.memo || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-blue-950">商品編集</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingProduct.code} の情報を変更します
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditDialog}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">商品画像</span>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 overflow-hidden rounded-xl border border-blue-100 bg-blue-50">
                    {editImagePreview ? (
                      <img src={editImagePreview} alt="商品画像プレビュー" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-blue-400">No Image</div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      void handleEditImageChange(event.target.files?.[0] ?? null)
                    }
                    className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  商品名 <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(event) => updateEditForm("name", event.target.value)}
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">上代</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editForm.jodai}
                  onChange={(event) => updateEditForm("jodai", event.target.value)}
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">原価</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editForm.genka}
                  onChange={(event) => updateEditForm("genka", event.target.value)}
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">在庫数</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editForm.stock}
                  onChange={(event) => updateEditForm("stock", event.target.value)}
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">保管場所</span>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(event) => updateEditForm("location", event.target.value)}
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">単位</span>
                <input
                  type="text"
                  value={editForm.unit}
                  onChange={(event) => updateEditForm("unit", event.target.value)}
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">備考</span>
                <textarea
                  value={editForm.notes}
                  onChange={(event) => updateEditForm("notes", event.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditDialog}
                  disabled={editSubmitting}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editSubmitting ? "保存中..." : "変更を保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedProduct && stockMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-blue-950">
                  {stockMode === "in" ? "入庫登録" : "出庫登録"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedProduct.code} {selectedProduct.name}
                </p>
                <p className="mt-1 text-sm font-medium text-blue-700">
                  現在庫: {formatNumber(selectedProduct.stock)}
                  {selectedProduct.unit ? ` ${selectedProduct.unit}` : " 点"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeStockDialog}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStockSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  数量 <span className="text-red-500">*</span>
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={stockForm.quantity}
                  onChange={(event) =>
                    updateStockForm("quantity", event.target.value)
                  }
                  placeholder="例: 5"
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  担当者
                </span>
                <input
                  type="text"
                  value={stockForm.userName}
                  onChange={(event) =>
                    updateStockForm("userName", event.target.value)
                  }
                  placeholder="管理者"
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  備考
                </span>
                <textarea
                  value={stockForm.memo}
                  onChange={(event) => updateStockForm("memo", event.target.value)}
                  placeholder="例: 仕入れ、販売、棚卸調整"
                  rows={3}
                  className="w-full resize-y rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeStockDialog}
                  disabled={stockSubmitting}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={stockSubmitting}
                  className={`rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    stockMode === "in"
                      ? "bg-blue-600 shadow-blue-600/25 hover:bg-blue-700"
                      : "bg-red-500 shadow-red-500/20 hover:bg-red-600"
                  }`}
                >
                  {stockSubmitting
                    ? "処理中..."
                    : stockMode === "in"
                      ? "入庫する"
                      : "出庫する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
