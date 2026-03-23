import "./global.css";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import React, { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

type ScreenKey =
  | "dashboard"
  | "inbound"
  | "grading"
  | "outbound"
  | "breakdown"
  | "transfer"
  | "inventory"
  | "master"
  | "login";

type PackagingType = "flex" | "bag" | "bulk";
type BreakdownMode = "flex" | "bag";
type CsvImportTarget = "producers" | "destinations" | "warehouses";
type UserRole = "warehouse_manager" | "grader" | "admin";

type ScreenItem = {
  key: ScreenKey;
  label: string;
};

type SelectOption = {
  label: string;
  value: string;
  description?: string;
};

type Producer = {
  id: string;
  name: string;
  kana: string;
  address: string;
  invoiceNumber: string;
  phone: string;
  notes: string;
};

type Destination = {
  id: string;
  name: string;
  contactPerson: string;
  address: string;
  phone: string;
  notes: string;
};

type Warehouse = {
  id: string;
  name: string;
  type: string;
  address: string;
  capacityKg: string;
  notes: string;
};

type InventoryUnit = {
  id: string;
  receivedDate: string;
  warehouseId: string;
  producerId: string;
  brand: string;
  quantityKg: number;
  packageType: PackagingType;
  grade: string | null;
  operatorName: string;
  notes: string;
  deleted?: boolean;
};

type MovementType = "入庫" | "等級確定" | "出庫" | "崩し" | "移動";

type MovementHistoryItem = {
  id: string;
  type: MovementType;
  date: string;
  detail: string;
  user: string;
  warehouseIds?: string[];
};

type UserProfile = {
  id: string;
  loginId: string;
  name: string;
  role: UserRole;
  warehouseId?: string;
};

type AppData = {
  producers: Producer[];
  destinations: Destination[];
  warehouses: Warehouse[];
  inventoryUnits: InventoryUnit[];
  movements: MovementHistoryItem[];
};

type InventorySummaryItem = {
  warehouseId: string;
  warehouseName: string;
  producerId: string;
  producerName: string;
  brand: string;
  grade: string;
  flexCount: number;
  bagCount: number;
  bulkKg: number;
  totalKg: number;
};

type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  tone?: "default" | "accent";
};

type FieldProps = {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
  keyboardType?: "default" | "numeric";
};

type DisplayFieldProps = {
  label: string;
  value: string;
  compact?: boolean;
  hint?: string;
};

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  compact?: boolean;
  placeholder?: string;
};

type ActionButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

type SelectPillProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

type StatTileProps = {
  label: string;
  value: string;
  note: string;
};

type ItemRowProps = {
  title: string;
  meta: string;
  right: string;
  badge?: string;
};

const STORAGE_KEY = "rice-warehouse-app-data-v1";
const FLEX_KG = 1080;
const BAG_KG = 30;

const screens: ScreenItem[] = [
  { key: "dashboard", label: "ホーム" },
  { key: "inbound", label: "入庫" },
  { key: "grading", label: "等級確定" },
  { key: "outbound", label: "出庫" },
  { key: "breakdown", label: "崩し" },
  { key: "transfer", label: "倉庫移動" },
  { key: "inventory", label: "在庫確認" },
  { key: "master", label: "マスタ" },
  { key: "login", label: "ログイン" },
];

const roleLabels: Record<UserRole, string> = {
  warehouse_manager: "倉庫管理者",
  grader: "等級確定者",
  admin: "倉庫全体管理者",
};

const screenAccess: Record<UserRole, ScreenKey[]> = {
  warehouse_manager: ["dashboard", "inbound", "outbound", "breakdown", "transfer", "inventory", "login"],
  grader: ["dashboard", "grading", "inventory", "login"],
  admin: ["dashboard", "inbound", "grading", "outbound", "breakdown", "transfer", "inventory", "master", "login"],
};

const brandOptions = ["コシヒカリ", "ひとめぼれ", "あきたこまち"];
const gradeOptions = ["特A", "A", "B"];
const csvTemplateMap: Record<CsvImportTarget, { fileName: string; header: string[]; sampleRows: string[][] }> = {
  producers: {
    fileName: "producers_template.csv",
    header: ["name", "kana", "address", "invoice_number", "phone", "notes"],
    sampleRows: [
      ["田中農園", "たなかのうえん", "新潟県南魚沼市〇〇1-2-3", "T1234567890123", "090-0000-0001", "主力生産者"],
      ["山本ライス", "やまもとらいす", "新潟県魚沼市〇〇4-5-6", "T1234567890456", "090-0000-0002", "低温倉庫利用"],
    ],
  },
  destinations: {
    fileName: "destinations_template.csv",
    header: ["name", "contact_person", "address", "phone", "notes"],
    sampleRows: [
      ["地場スーパー", "青果部", "新潟県南魚沼市〇〇7-8-9", "025-000-0001", "午前納品希望"],
      ["業務卸A", "仕入担当", "新潟県長岡市〇〇1-1-1", "0258-00-0002", "パレット搬入"],
    ],
  },
  warehouses: {
    fileName: "warehouses_template.csv",
    header: ["name", "type", "address", "capacity_kg", "notes"],
    sampleRows: [
      ["第1倉庫", "常温", "新潟県南魚沼市六日町〇〇", "50000", "フレコン優先"],
      ["低温倉庫", "低温", "新潟県南魚沼市塩沢〇〇", "30000", "品質保持用"],
    ],
  },
};

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const nowStamp = () => new Date().toLocaleString("ja-JP", { hour12: false });
const todayStamp = () => new Date().toISOString().slice(0, 10);

const kgPerUnit = (type: PackagingType | BreakdownMode) => {
  if (type === "flex") {
    return FLEX_KG;
  }
  if (type === "bag") {
    return BAG_KG;
  }
  return 1;
};

const formatUnitQuantity = (unit: InventoryUnit) => {
  if (unit.packageType === "flex") {
    return `${Math.floor(unit.quantityKg / FLEX_KG)}本 / ${unit.quantityKg}kg`;
  }
  if (unit.packageType === "bag") {
    return `${Math.floor(unit.quantityKg / BAG_KG)}袋 / ${unit.quantityKg}kg`;
  }
  return `${unit.quantityKg}kg`;
};

const formatMovementType = (type: PackagingType | BreakdownMode, quantityKg: number) => {
  if (type === "flex") {
    return `${Math.round(quantityKg / FLEX_KG)}本`;
  }
  if (type === "bag") {
    return `${Math.round(quantityKg / BAG_KG)}袋`;
  }
  return `${quantityKg}kg`;
};

const escapeCsvCell = (value: string) => {
  const normalized = String(value ?? "");
  if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const buildCsvText = (target: CsvImportTarget) => {
  const template = csvTemplateMap[target];
  return [template.header.join(","), ...template.sampleRows.map((row) => row.map(escapeCsvCell).join(","))].join("\n");
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
};

const buildDefaultData = (): AppData => {
  const warehouse1 = "warehouse-1";
  const warehouse2 = "warehouse-2";
  const warehouse3 = "warehouse-3";
  const producer1 = "producer-1";
  const producer2 = "producer-2";
  const producer3 = "producer-3";

  return {
    producers: [
      {
        id: producer1,
        name: "田中農園",
        kana: "たなかのうえん",
        address: "新潟県南魚沼市〇〇1-2-3",
        invoiceNumber: "T1234567890123",
        phone: "090-0000-0001",
        notes: "主力生産者",
      },
      {
        id: producer2,
        name: "山本ライス",
        kana: "やまもとらいす",
        address: "新潟県魚沼市〇〇4-5-6",
        invoiceNumber: "T1234567890456",
        phone: "090-0000-0002",
        notes: "低温倉庫利用",
      },
      {
        id: producer3,
        name: "青木アグリ",
        kana: "あおきあぐり",
        address: "新潟県長岡市〇〇7-8-9",
        invoiceNumber: "T1234567890789",
        phone: "090-0000-0003",
        notes: "袋在庫中心",
      },
    ],
    destinations: [
      {
        id: "destination-1",
        name: "地場スーパー",
        contactPerson: "青果部",
        address: "新潟県南魚沼市〇〇7-8-9",
        phone: "025-000-0001",
        notes: "午前納品希望",
      },
      {
        id: "destination-2",
        name: "業務卸A",
        contactPerson: "仕入担当",
        address: "新潟県長岡市〇〇1-1-1",
        phone: "0258-00-0002",
        notes: "パレット搬入",
      },
    ],
    warehouses: [
      {
        id: warehouse1,
        name: "第1倉庫",
        type: "常温",
        address: "南魚沼市六日町〇〇",
        capacityKg: "50000",
        notes: "フレコン優先",
      },
      {
        id: warehouse2,
        name: "第2倉庫",
        type: "常温",
        address: "南魚沼市塩沢〇〇",
        capacityKg: "40000",
        notes: "袋在庫向け",
      },
      {
        id: warehouse3,
        name: "低温倉庫",
        type: "低温",
        address: "南魚沼市石打〇〇",
        capacityKg: "30000",
        notes: "品質保持用",
      },
    ],
    inventoryUnits: [
      {
        id: "unit-1",
        receivedDate: "2026-03-21",
        warehouseId: warehouse1,
        producerId: producer1,
        brand: "コシヒカリ",
        quantityKg: 4320,
        packageType: "flex",
        grade: "特A",
        operatorName: "佐藤",
        notes: "初期データ",
      },
      {
        id: "unit-2",
        receivedDate: "2026-03-21",
        warehouseId: warehouse3,
        producerId: producer2,
        brand: "ひとめぼれ",
        quantityKg: 720,
        packageType: "bulk",
        grade: "A",
        operatorName: "高橋",
        notes: "初期データ",
      },
      {
        id: "unit-3",
        receivedDate: "2026-03-22",
        warehouseId: warehouse2,
        producerId: producer3,
        brand: "あきたこまち",
        quantityKg: 600,
        packageType: "bag",
        grade: null,
        operatorName: "伊藤",
        notes: "初期データ",
      },
    ],
    movements: [
      {
        id: "mv-1",
        type: "出庫",
        date: "2026/03/21 09:10:00",
        detail: "第1倉庫 コシヒカリ 2本 -> 地場スーパー",
        user: "佐藤",
        warehouseIds: [warehouse1],
      },
      {
        id: "mv-2",
        type: "移動",
        date: "2026/03/21 13:40:00",
        detail: "第2倉庫 -> 低温倉庫 540kg",
        user: "高橋",
        warehouseIds: [warehouse2, warehouse3],
      },
      {
        id: "mv-3",
        type: "入庫",
        date: "2026/03/22 08:15:00",
        detail: "青木アグリ あきたこまち 600kg",
        user: "伊藤",
        warehouseIds: [warehouse2],
      },
    ],
  };
};

function SectionCard({ title, subtitle, children, tone = "default" }: SectionCardProps) {
  const wrapperClassName =
    tone === "accent"
      ? "rounded-3xl border border-[#1C3328] bg-[#1C3328] p-4"
      : "rounded-3xl border border-[#E4DBCD] bg-[#FFFDFC] p-4";

  const titleClassName =
    tone === "accent" ? "text-lg font-extrabold text-[#F7F3EC]" : "text-lg font-extrabold text-[#223427]";

  const subtitleClassName =
    tone === "accent" ? "mt-1 text-[13px] leading-5 text-[#C5D8CD]" : "mt-1 text-[13px] leading-5 text-[#697467]";

  return (
    <View className={wrapperClassName}>
      <View className="mb-3.5">
        <Text className={titleClassName}>{title}</Text>
        {subtitle ? <Text className={subtitleClassName}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, compact = false, keyboardType = "default" }: FieldProps) {
  return (
    <View className={compact ? "mb-0 flex-1" : "mb-3"}>
      <Text className="mb-1.5 text-[13px] font-bold text-[#485447]">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        placeholderTextColor="#8C94A6"
        className="h-12 rounded-2xl border border-[#DCCFBE] bg-[#F8F4ED] px-3.5 text-[15px] text-[#203126]"
      />
    </View>
  );
}

function DisplayField({ label, value, compact = false, hint = "自動入力" }: DisplayFieldProps) {
  return (
    <View className={compact ? "mb-0 flex-1" : "mb-3"}>
      <Text className="mb-1.5 text-[13px] font-bold text-[#485447]">{label}</Text>
      <View className="h-12 flex-row items-center justify-between rounded-2xl border border-[#C9D7CE] bg-[#EEF3EF] px-3.5">
        <Text className="text-[15px] text-[#203126]">{value}</Text>
        <Text className="text-xs font-bold text-[#4F6B5E]">{hint}</Text>
      </View>
    </View>
  );
}

function SelectField({ label, value, onChange, options, compact = false, placeholder = "選択してください" }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View className={compact ? "mb-0 flex-1" : "mb-3"}>
      <Text className="mb-1.5 text-[13px] font-bold text-[#485447]">{label}</Text>
      <Pressable
        className="min-h-12 flex-row items-center justify-between rounded-2xl border border-[#DCCFBE] bg-[#F8F4ED] px-3.5 py-3"
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text className={`text-[15px] ${selected ? "text-[#203126]" : "text-[#8C94A6]"}`}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text className="text-sm text-[#6E776E]">{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <View className="mt-2 rounded-2xl border border-[#E4DBCD] bg-white">
          {options.map((option) => (
            <Pressable
              key={option.value}
              className="border-b border-[#EFE5D8] px-3.5 py-3 last:border-b-0"
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <Text className="text-[15px] font-bold text-[#223327]">{option.label}</Text>
              {option.description ? <Text className="mt-1 text-xs text-[#717B73]">{option.description}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SelectPill({ label, active = false, onPress }: SelectPillProps) {
  return (
    <Pressable
      onPress={onPress}
      className={
        active
          ? "rounded-full border border-[#1A8E5F] bg-[#E2F1E9] px-3.5 py-2.5"
          : "rounded-full border border-[#DECFBA] bg-[#F4EBDD] px-3.5 py-2.5"
      }
    >
      <Text className={active ? "font-bold text-[#1A8E5F]" : "font-bold text-[#586656]"}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({ label, onPress, variant = "primary", disabled = false }: ActionButtonProps) {
  const className =
    disabled
      ? "min-h-12 items-center justify-center rounded-2xl bg-[#C7D0CB] px-4"
      : variant === "secondary"
        ? "min-h-12 items-center justify-center rounded-2xl border border-[#C8D8CF] bg-[#EEF3EF] px-4"
        : "min-h-12 items-center justify-center rounded-2xl bg-[#1A8E5F] px-4";

  const textClassName =
    disabled
      ? "text-sm font-extrabold text-white"
      : variant === "secondary"
        ? "text-sm font-extrabold text-[#255841]"
        : "text-sm font-extrabold text-white";

  return (
    <Pressable disabled={disabled} onPress={onPress} className={className}>
      <Text className={textClassName}>{label}</Text>
    </Pressable>
  );
}

function StatTile({ label, value, note }: StatTileProps) {
  return (
    <View className="min-w-[47%] flex-1 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.10)] p-3.5">
      <Text className="text-[26px] font-extrabold text-white">{value}</Text>
      <Text className="mt-1.5 text-sm font-bold text-[#E5F2EB]">{label}</Text>
      <Text className="mt-1 text-xs text-[#B8D4C5]">{note}</Text>
    </View>
  );
}

function ItemRow({ title, meta, right, badge }: ItemRowProps) {
  return (
    <View className="flex-row items-center justify-between gap-3 border-t border-[#EEE5D9] py-3.5">
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-[15px] font-bold text-[#223327]">{title}</Text>
          {badge ? (
            <View className="rounded-full bg-[#F2E5CF] px-2 py-1">
              <Text className="text-[11px] font-bold text-[#7A5721]">{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-xs text-[#717B73]">{meta}</Text>
      </View>
      <Text className="shrink text-right text-[13px] font-bold text-[#2C493A]">{right}</Text>
    </View>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenKey>("dashboard");
  const [hydrated, setHydrated] = useState(false);
  const [appData, setAppData] = useState<AppData>(buildDefaultData);
  const [currentUserId, setCurrentUserId] = useState("user-admin");

  const [inboundDate, setInboundDate] = useState(todayStamp());
  const [inboundWarehouseId, setInboundWarehouseId] = useState("");
  const [inboundProducerId, setInboundProducerId] = useState("");
  const [inboundBrand, setInboundBrand] = useState(brandOptions[0]);
  const [inboundPackageType, setInboundPackageType] = useState<PackagingType>("flex");
  const [inboundQuantity, setInboundQuantity] = useState("1");
  const [inboundNotes, setInboundNotes] = useState("");

  const [gradingUnitId, setGradingUnitId] = useState("");
  const [gradingGrade, setGradingGrade] = useState(gradeOptions[0]);

  const [outboundWarehouseId, setOutboundWarehouseId] = useState("");
  const [outboundDestinationId, setOutboundDestinationId] = useState("");
  const [outboundUnitId, setOutboundUnitId] = useState("");
  const [outboundMode, setOutboundMode] = useState<PackagingType>("flex");
  const [outboundQuantity, setOutboundQuantity] = useState("1");
  const [outboundNotes, setOutboundNotes] = useState("");

  const [breakdownUnitId, setBreakdownUnitId] = useState("");
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>("flex");
  const [breakdownQuantity, setBreakdownQuantity] = useState("1");

  const [transferFromWarehouseId, setTransferFromWarehouseId] = useState("");
  const [transferToWarehouseId, setTransferToWarehouseId] = useState("");
  const [transferUnitId, setTransferUnitId] = useState("");
  const [transferMode, setTransferMode] = useState<PackagingType>("flex");
  const [transferQuantity, setTransferQuantity] = useState("1");

  const [inventoryWarehouseFilter, setInventoryWarehouseFilter] = useState("all");
  const [inventoryProducerFilter, setInventoryProducerFilter] = useState("all");
  const [inventoryGradeFilter, setInventoryGradeFilter] = useState("all");
  const [hideZero, setHideZero] = useState(true);

  const [producerForm, setProducerForm] = useState({
    name: "",
    kana: "",
    address: "",
    invoiceNumber: "",
    phone: "",
    notes: "",
  });
  const [destinationForm, setDestinationForm] = useState({
    name: "",
    contactPerson: "",
    address: "",
    phone: "",
    notes: "",
  });
  const [warehouseForm, setWarehouseForm] = useState({
    name: "",
    type: "",
    address: "",
    capacityKg: "",
    notes: "",
  });
  const [csvImportTarget, setCsvImportTarget] = useState<CsvImportTarget>("producers");
  const [csvTemplatePreview, setCsvTemplatePreview] = useState(buildCsvText("producers"));
  const [csvStatusMessage, setCsvStatusMessage] = useState("CSVテンプレートを確認するか、CSVを選択して取込してください。");

  const users = useMemo<UserProfile[]>(
    () => [
      {
        id: "user-warehouse",
        loginId: "warehouse-sato",
        name: "佐藤",
        role: "warehouse_manager",
        warehouseId: appData.warehouses[0]?.id,
      },
      {
        id: "user-grader",
        loginId: "grader-takahashi",
        name: "高橋",
        role: "grader",
        warehouseId: appData.warehouses[1]?.id,
      },
      {
        id: "user-admin",
        loginId: "admin-ito",
        name: "伊藤",
        role: "admin",
      },
    ],
    [appData.warehouses]
  );

  const currentUser = useMemo<UserProfile>(() => users.find((user) => user.id === currentUserId) || users[0], [currentUserId, users]);
  const currentRoleLabel = roleLabels[currentUser.role];
  const scopedWarehouseId = currentUser.role === "admin" ? null : currentUser.warehouseId || null;
  const allowedScreens = screenAccess[currentUser.role];

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          setAppData(JSON.parse(saved) as AppData);
        }
      } catch (error) {
        console.error("Failed to load local data", error);
      } finally {
        setHydrated(true);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }, [appData, hydrated]);

  useEffect(() => {
    if (!allowedScreens.includes(currentScreen)) {
      setCurrentScreen(allowedScreens[0]);
    }
  }, [allowedScreens, currentScreen]);

  useEffect(() => {
    if (!inboundWarehouseId && appData.warehouses[0]) {
      setInboundWarehouseId(appData.warehouses[0].id);
    }
    if (!outboundWarehouseId && appData.warehouses[0]) {
      setOutboundWarehouseId(appData.warehouses[0].id);
    }
    if (!transferFromWarehouseId && appData.warehouses[0]) {
      setTransferFromWarehouseId(appData.warehouses[0].id);
    }
    if (!transferToWarehouseId && appData.warehouses[1]) {
      setTransferToWarehouseId(appData.warehouses[1].id);
    }
  }, [appData.warehouses, inboundWarehouseId, outboundWarehouseId, transferFromWarehouseId, transferToWarehouseId]);

  useEffect(() => {
    if (!inboundProducerId && appData.producers[0]) {
      setInboundProducerId(appData.producers[0].id);
    }
    if (!outboundDestinationId && appData.destinations[0]) {
      setOutboundDestinationId(appData.destinations[0].id);
    }
  }, [appData.producers, appData.destinations, inboundProducerId, outboundDestinationId]);

  const warehouseMap = useMemo(() => new Map(appData.warehouses.map((item) => [item.id, item])), [appData.warehouses]);
  const producerMap = useMemo(() => new Map(appData.producers.map((item) => [item.id, item])), [appData.producers]);
  const destinationMap = useMemo(() => new Map(appData.destinations.map((item) => [item.id, item])), [appData.destinations]);

  const activeUnits = useMemo(
    () =>
      appData.inventoryUnits.filter(
        (item) => !item.deleted && item.quantityKg > 0 && (!scopedWarehouseId || item.warehouseId === scopedWarehouseId)
      ),
    [appData.inventoryUnits, scopedWarehouseId]
  );

  const visibleMovements = useMemo(
    () =>
      appData.movements.filter((item) =>
        !scopedWarehouseId ? true : (item.warehouseIds || []).includes(scopedWarehouseId)
      ),
    [appData.movements, scopedWarehouseId]
  );

  const inventorySummary = useMemo<InventorySummaryItem[]>(() => {
    const summaryMap = new Map<string, InventorySummaryItem>();

    activeUnits.forEach((unit) => {
      const warehouseName = warehouseMap.get(unit.warehouseId)?.name || "未設定倉庫";
      const producerName = producerMap.get(unit.producerId)?.name || "未設定生産者";
      const grade = unit.grade || "未設定";
      const key = [unit.warehouseId, unit.producerId, unit.brand, grade].join(":");
      const current =
        summaryMap.get(key) || {
          warehouseId: unit.warehouseId,
          warehouseName,
          producerId: unit.producerId,
          producerName,
          brand: unit.brand,
          grade,
          flexCount: 0,
          bagCount: 0,
          bulkKg: 0,
          totalKg: 0,
        };

      if (unit.packageType === "flex") {
        current.flexCount += Math.floor(unit.quantityKg / FLEX_KG);
      } else if (unit.packageType === "bag") {
        current.bagCount += Math.floor(unit.quantityKg / BAG_KG);
      } else {
        current.bulkKg += unit.quantityKg;
      }

      current.totalKg += unit.quantityKg;
      summaryMap.set(key, current);
    });

    return Array.from(summaryMap.values()).sort((a, b) => a.warehouseName.localeCompare(b.warehouseName, "ja"));
  }, [activeUnits, producerMap, warehouseMap]);

  const visibleInventorySummary = useMemo(() => {
    return inventorySummary.filter((item) => {
      if (inventoryWarehouseFilter !== "all" && item.warehouseId !== inventoryWarehouseFilter) {
        return false;
      }
      if (inventoryProducerFilter !== "all" && item.producerId !== inventoryProducerFilter) {
        return false;
      }
      if (inventoryGradeFilter !== "all" && item.grade !== inventoryGradeFilter) {
        return false;
      }
      if (hideZero && item.totalKg <= 0) {
        return false;
      }
      return true;
    });
  }, [hideZero, inventoryGradeFilter, inventoryProducerFilter, inventorySummary, inventoryWarehouseFilter]);

  const pendingGradingUnits = useMemo(
    () => activeUnits.filter((item) => item.grade === null),
    [activeUnits]
  );

  const outboundCandidateUnits = useMemo(
    () =>
      activeUnits.filter(
        (item) => item.grade !== null && (!outboundWarehouseId || item.warehouseId === outboundWarehouseId)
      ),
    [activeUnits, outboundWarehouseId]
  );

  const breakdownCandidateUnits = useMemo(
    () => activeUnits.filter((item) => item.packageType === breakdownMode),
    [activeUnits, breakdownMode]
  );

  const transferCandidateUnits = useMemo(
    () => activeUnits.filter((item) => item.warehouseId === transferFromWarehouseId),
    [activeUnits, transferFromWarehouseId]
  );

  const activeScreen = useMemo<ScreenItem>(
    () => screens.find((screen) => screen.key === currentScreen) || screens[0],
    [currentScreen]
  );

  const visibleWarehouses = useMemo(
    () => appData.warehouses.filter((item) => (!scopedWarehouseId ? true : item.id === scopedWarehouseId)),
    [appData.warehouses, scopedWarehouseId]
  );

  const warehouseOptions: SelectOption[] = visibleWarehouses.map((item) => ({
    label: item.name,
    value: item.id,
    description: `${item.type} / ${item.capacityKg}kg`,
  }));

  const producerOptions: SelectOption[] = appData.producers.map((item) => ({
    label: item.name,
    value: item.id,
    description: item.kana,
  }));

  const destinationOptions: SelectOption[] = appData.destinations.map((item) => ({
    label: item.name,
    value: item.id,
    description: item.contactPerson,
  }));

  const inventoryUnitOptions: SelectOption[] = activeUnits.map((item) => ({
    label: `${producerMap.get(item.producerId)?.name || "未設定"} / ${item.brand}`,
    value: item.id,
    description: `${warehouseMap.get(item.warehouseId)?.name || "未設定"} / ${formatUnitQuantity(item)} / ${
      item.grade || "未設定"
    }`,
  }));

  const gradingUnitOptions: SelectOption[] = pendingGradingUnits.map((item) => ({
    label: `${producerMap.get(item.producerId)?.name || "未設定"} / ${item.brand}`,
    value: item.id,
    description: `${warehouseMap.get(item.warehouseId)?.name || "未設定"} / ${formatUnitQuantity(item)}`,
  }));

  const outboundUnitOptions: SelectOption[] = outboundCandidateUnits.map((item) => ({
    label: `${producerMap.get(item.producerId)?.name || "未設定"} / ${item.brand}`,
    value: item.id,
    description: `${formatUnitQuantity(item)} / ${item.grade || "未設定"}`,
  }));

  const breakdownUnitOptions: SelectOption[] = breakdownCandidateUnits.map((item) => ({
    label: `${producerMap.get(item.producerId)?.name || "未設定"} / ${item.brand}`,
    value: item.id,
    description: `${warehouseMap.get(item.warehouseId)?.name || "未設定"} / ${formatUnitQuantity(item)}`,
  }));

  const transferUnitOptions: SelectOption[] = transferCandidateUnits.map((item) => ({
    label: `${producerMap.get(item.producerId)?.name || "未設定"} / ${item.brand}`,
    value: item.id,
    description: `${formatUnitQuantity(item)} / ${item.grade || "未設定"}`,
  }));

  const appendMovement = (type: MovementType, detail: string, warehouseIds: string[]) => {
    const record: MovementHistoryItem = {
      id: createId("mv"),
      type,
      date: nowStamp(),
      detail,
      user: currentUser.name,
      warehouseIds,
    };
    return record;
  };

  const saveProducer = () => {
    if (!producerForm.name.trim()) {
      Alert.alert("生産者登録", "名称を入力してください。");
      return;
    }
    const record: Producer = {
      id: createId("producer"),
      ...producerForm,
    };
    setAppData((prev) => ({ ...prev, producers: [record, ...prev.producers] }));
    setProducerForm({ name: "", kana: "", address: "", invoiceNumber: "", phone: "", notes: "" });
  };

  const saveDestination = () => {
    if (!destinationForm.name.trim()) {
      Alert.alert("納品先登録", "納品先名を入力してください。");
      return;
    }
    const record: Destination = { id: createId("destination"), ...destinationForm };
    setAppData((prev) => ({ ...prev, destinations: [record, ...prev.destinations] }));
    setDestinationForm({ name: "", contactPerson: "", address: "", phone: "", notes: "" });
  };

  const saveWarehouse = () => {
    if (!warehouseForm.name.trim()) {
      Alert.alert("倉庫登録", "倉庫名を入力してください。");
      return;
    }
    const record: Warehouse = { id: createId("warehouse"), ...warehouseForm };
    setAppData((prev) => ({ ...prev, warehouses: [record, ...prev.warehouses] }));
    setWarehouseForm({ name: "", type: "", address: "", capacityKg: "", notes: "" });
  };

  const registerInbound = () => {
    const numericQuantity = Number(inboundQuantity);
    if (!inboundWarehouseId || !inboundProducerId || !inboundBrand || !numericQuantity || numericQuantity <= 0) {
      Alert.alert("入庫登録", "倉庫、生産者、数量を正しく入力してください。");
      return;
    }
    const quantityKg = inboundPackageType === "bulk" ? numericQuantity : numericQuantity * kgPerUnit(inboundPackageType);
    const unit: InventoryUnit = {
      id: createId("unit"),
      receivedDate: inboundDate || todayStamp(),
      warehouseId: inboundWarehouseId,
      producerId: inboundProducerId,
      brand: inboundBrand,
      quantityKg,
      packageType: inboundPackageType,
      grade: null,
      operatorName: currentUser.name,
      notes: inboundNotes,
    };
    const warehouseName = warehouseMap.get(inboundWarehouseId)?.name || "未設定倉庫";
    const producerName = producerMap.get(inboundProducerId)?.name || "未設定生産者";
    const movement = appendMovement("入庫", `${warehouseName} / ${producerName} / ${inboundBrand} / ${quantityKg}kg`, [inboundWarehouseId]);

    setAppData((prev) => ({
      ...prev,
      inventoryUnits: [unit, ...prev.inventoryUnits],
      movements: [movement, ...prev.movements],
    }));

    setInboundQuantity("1");
    setInboundNotes("");
  };

  const confirmGrade = () => {
    if (!gradingUnitId) {
      Alert.alert("等級確定", "対象在庫を選択してください。");
      return;
    }
    const target = activeUnits.find((item) => item.id === gradingUnitId);
    if (!target) {
      return;
    }
    const producerName = producerMap.get(target.producerId)?.name || "未設定生産者";
    const movement = appendMovement("等級確定", `${producerName} / ${target.brand} / ${gradingGrade}`, [target.warehouseId]);

    setAppData((prev) => ({
      ...prev,
      inventoryUnits: prev.inventoryUnits.map((item) =>
        item.id === gradingUnitId ? { ...item, grade: gradingGrade } : item
      ),
      movements: [movement, ...prev.movements],
    }));
    setGradingUnitId("");
  };

  const registerOutbound = () => {
    const numericQuantity = Number(outboundQuantity);
    const unit = activeUnits.find((item) => item.id === outboundUnitId);
    if (!unit || !outboundDestinationId || !numericQuantity || numericQuantity <= 0) {
      Alert.alert("出庫登録", "対象在庫、納品先、数量を確認してください。");
      return;
    }

    const quantityKg = outboundMode === "bulk" ? numericQuantity : numericQuantity * kgPerUnit(outboundMode);
    if (unit.quantityKg < quantityKg) {
      Alert.alert("出庫登録", "出庫数量が在庫を超えています。");
      return;
    }

    const destinationName = destinationMap.get(outboundDestinationId)?.name || "未設定納品先";
    const warehouseName = warehouseMap.get(unit.warehouseId)?.name || "未設定倉庫";
    const movement = appendMovement(
      "出庫",
      `${warehouseName} / ${unit.brand} / ${formatMovementType(outboundMode, quantityKg)} -> ${destinationName}`,
      [unit.warehouseId]
    );

    setAppData((prev) => ({
      ...prev,
      inventoryUnits: prev.inventoryUnits.map((item) =>
        item.id === unit.id ? { ...item, quantityKg: item.quantityKg - quantityKg, notes: outboundNotes || item.notes } : item
      ),
      movements: [movement, ...prev.movements],
    }));
    setOutboundQuantity("1");
    setOutboundNotes("");
    setOutboundUnitId("");
  };

  const registerBreakdown = () => {
    const numericQuantity = Number(breakdownQuantity);
    const unit = activeUnits.find((item) => item.id === breakdownUnitId);
    if (!unit || !numericQuantity || numericQuantity <= 0) {
      Alert.alert("崩し", "対象在庫と数量を確認してください。");
      return;
    }
    const quantityKg = numericQuantity * kgPerUnit(breakdownMode);
    if (unit.quantityKg < quantityKg) {
      Alert.alert("崩し", "崩す数量が在庫を超えています。");
      return;
    }

    const newBulkUnit: InventoryUnit = {
      id: createId("unit"),
      receivedDate: todayStamp(),
      warehouseId: unit.warehouseId,
      producerId: unit.producerId,
      brand: unit.brand,
      quantityKg,
      packageType: "bulk",
      grade: unit.grade,
      operatorName: currentUser.name,
      notes: `${breakdownMode === "flex" ? "フレコン" : "袋"}崩し`,
    };

    const movement = appendMovement(
      "崩し",
      `${unit.brand} / ${formatMovementType(breakdownMode, quantityKg)} -> バラ ${quantityKg}kg`,
      [unit.warehouseId]
    );

    setAppData((prev) => ({
      ...prev,
      inventoryUnits: [
        newBulkUnit,
        ...prev.inventoryUnits.map((item) =>
          item.id === unit.id ? { ...item, quantityKg: item.quantityKg - quantityKg } : item
        ),
      ],
      movements: [movement, ...prev.movements],
    }));
    setBreakdownQuantity("1");
    setBreakdownUnitId("");
  };

  const registerTransfer = () => {
    const numericQuantity = Number(transferQuantity);
    const unit = activeUnits.find((item) => item.id === transferUnitId);
    if (!unit || !transferToWarehouseId || !numericQuantity || numericQuantity <= 0) {
      Alert.alert("倉庫間移動", "移動対象、移動先、数量を確認してください。");
      return;
    }
    if (transferFromWarehouseId === transferToWarehouseId) {
      Alert.alert("倉庫間移動", "移動元と移動先は別の倉庫にしてください。");
      return;
    }
    const quantityKg = transferMode === "bulk" ? numericQuantity : numericQuantity * kgPerUnit(transferMode);
    if (unit.quantityKg < quantityKg) {
      Alert.alert("倉庫間移動", "移動数量が在庫を超えています。");
      return;
    }

    const movedUnit: InventoryUnit = {
      ...unit,
      id: createId("unit"),
      receivedDate: todayStamp(),
      warehouseId: transferToWarehouseId,
      quantityKg,
      operatorName: currentUser.name,
      notes: "倉庫間移動",
    };
    const fromWarehouseName = warehouseMap.get(transferFromWarehouseId)?.name || "未設定倉庫";
    const toWarehouseName = warehouseMap.get(transferToWarehouseId)?.name || "未設定倉庫";
    const movement = appendMovement("移動", `${fromWarehouseName} -> ${toWarehouseName} / ${quantityKg}kg`, [transferFromWarehouseId, transferToWarehouseId]);

    setAppData((prev) => ({
      ...prev,
      inventoryUnits: [
        movedUnit,
        ...prev.inventoryUnits.map((item) =>
          item.id === unit.id ? { ...item, quantityKg: item.quantityKg - quantityKg } : item
        ),
      ],
      movements: [movement, ...prev.movements],
    }));

    setTransferQuantity("1");
    setTransferUnitId("");
  };

  const resetStorage = () => {
    const defaults = buildDefaultData();
    setAppData(defaults);
    setProducerForm({ name: "", kana: "", address: "", invoiceNumber: "", phone: "", notes: "" });
    setDestinationForm({ name: "", contactPerson: "", address: "", phone: "", notes: "" });
    setWarehouseForm({ name: "", type: "", address: "", capacityKg: "", notes: "" });
    setCsvStatusMessage("ローカルデータを初期状態に戻しました。");
  };

  const importCsvRecords = (target: CsvImportTarget, text: string) => {
    const rows = parseCsv(text);
    if (rows.length <= 1) {
      Alert.alert("CSV取込", "データ行が見つかりません。");
      return;
    }

    const [, ...dataRows] = rows;

    if (target === "producers") {
      const records: Producer[] = dataRows
        .filter((row) => row[0])
        .map((row) => ({
          id: createId("producer"),
          name: row[0] || "",
          kana: row[1] || "",
          address: row[2] || "",
          invoiceNumber: row[3] || "",
          phone: row[4] || "",
          notes: row[5] || "",
        }));
      setAppData((prev) => ({ ...prev, producers: [...records, ...prev.producers] }));
      setCsvStatusMessage(`生産者CSVを ${records.length} 件取り込みました。`);
      return;
    }

    if (target === "destinations") {
      const records: Destination[] = dataRows
        .filter((row) => row[0])
        .map((row) => ({
          id: createId("destination"),
          name: row[0] || "",
          contactPerson: row[1] || "",
          address: row[2] || "",
          phone: row[3] || "",
          notes: row[4] || "",
        }));
      setAppData((prev) => ({ ...prev, destinations: [...records, ...prev.destinations] }));
      setCsvStatusMessage(`納品先CSVを ${records.length} 件取り込みました。`);
      return;
    }

    const records: Warehouse[] = dataRows
      .filter((row) => row[0])
      .map((row) => ({
        id: createId("warehouse"),
        name: row[0] || "",
        type: row[1] || "",
        address: row[2] || "",
        capacityKg: row[3] || "",
        notes: row[4] || "",
      }));
    setAppData((prev) => ({ ...prev, warehouses: [...records, ...prev.warehouses] }));
    setCsvStatusMessage(`倉庫CSVを ${records.length} 件取り込みました。`);
  };

  const handleCsvTemplatePreview = () => {
    const text = buildCsvText(csvImportTarget);
    setCsvTemplatePreview(text);
    setCsvStatusMessage(`${csvTemplateMap[csvImportTarget].fileName} のテンプレートを表示しています。`);
  };

  const handleTemplateDownload = () => {
    const text = buildCsvText(csvImportTarget);
    setCsvTemplatePreview(text);

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = csvTemplateMap[csvImportTarget].fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setCsvStatusMessage(`${csvTemplateMap[csvImportTarget].fileName} をダウンロードしました。`);
      return;
    }

    setCsvStatusMessage(`${csvTemplateMap[csvImportTarget].fileName} のテンプレート内容を表示しました。`);
  };

  const handleCsvImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "*/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || result.assets.length === 0) {
        setCsvStatusMessage("CSV選択をキャンセルしました。");
        return;
      }

      const asset = result.assets[0];
      const text = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      importCsvRecords(csvImportTarget, text);
    } catch (error) {
      console.error("Failed to import CSV", error);
      Alert.alert("CSV取込", "CSVの読込に失敗しました。");
    }
  };

  const screenMap: Record<ScreenKey, ReactNode> = {
    dashboard: (
      <View className="gap-4">
        <SectionCard title="本日の状況" subtitle="ローカルストレージ内データの集計" tone="accent">
          <View className="flex-row flex-wrap gap-3">
            <StatTile label="生産者数" value={`${appData.producers.length}件`} note="登録済みマスタ" />
            <StatTile label="等級待ち" value={`${pendingGradingUnits.length}件`} note="未確定在庫" />
            <StatTile label="在庫単位" value={`${activeUnits.length}件`} note="有効在庫のみ" />
            <StatTile label="履歴件数" value={`${visibleMovements.length}件`} note="権限範囲の履歴" />
          </View>
        </SectionCard>

        <SectionCard title="今日の優先作業">
          <View className="mb-3 flex-row flex-wrap gap-2">
            <SelectPill label="入庫登録へ" active={currentScreen === "inbound"} onPress={() => setCurrentScreen("inbound")} />
            <SelectPill label="等級確定へ" active={currentScreen === "grading"} onPress={() => setCurrentScreen("grading")} />
            <SelectPill label="在庫確認へ" active={currentScreen === "inventory"} onPress={() => setCurrentScreen("inventory")} />
          </View>
        </SectionCard>

        <SectionCard title="最新の操作履歴" subtitle="AsyncStorage に保存される操作ログ">
          {visibleMovements.slice(0, 6).map((item) => (
            <ItemRow key={item.id} title={item.type} meta={`${item.date} / ${item.user}`} right={item.detail} />
          ))}
        </SectionCard>
      </View>
    ),
    inbound: (
      <View className="gap-4">
        <SectionCard title="入庫登録" subtitle="登録済みマスタを選択して在庫単位を生成">
          <View className="mb-3 flex-row gap-3">
            <Field label="入庫日" value={inboundDate} onChangeText={setInboundDate} compact />
            <DisplayField label="担当者" value={`${currentUser.name} / ${currentRoleLabel}`} compact />
          </View>
          <SelectField label="倉庫" value={inboundWarehouseId} onChange={setInboundWarehouseId} options={warehouseOptions} />
          <SelectField label="生産者" value={inboundProducerId} onChange={setInboundProducerId} options={producerOptions} />
          <SelectField
            label="銘柄"
            value={inboundBrand}
            onChange={setInboundBrand}
            options={brandOptions.map((item) => ({ label: item, value: item }))}
          />
          <View className="mb-3 flex-row gap-3">
            <Field label="数量" value={inboundQuantity} onChangeText={setInboundQuantity} compact keyboardType="numeric" />
            <DisplayField
              label="kg換算"
              value={`${(Number(inboundQuantity) || 0) * kgPerUnit(inboundPackageType)}kg`}
              compact
            />
          </View>
          <View className="mb-3 flex-row flex-wrap gap-2">
            <SelectPill label="フレコン" active={inboundPackageType === "flex"} onPress={() => setInboundPackageType("flex")} />
            <SelectPill label="30kg袋" active={inboundPackageType === "bag"} onPress={() => setInboundPackageType("bag")} />
            <SelectPill label="バラ" active={inboundPackageType === "bulk"} onPress={() => setInboundPackageType("bulk")} />
          </View>
          <Field label="備考" value={inboundNotes} onChangeText={setInboundNotes} placeholder="検査前。等級未設定で登録" />
          <View className="mt-1.5 flex-row flex-wrap gap-2.5">
            <ActionButton label="入庫を登録" onPress={registerInbound} />
          </View>
        </SectionCard>

        <SectionCard title="現在の入庫在庫">
          {activeUnits.slice(0, 8).map((item) => (
            <ItemRow
              key={item.id}
              title={`${item.brand} / ${producerMap.get(item.producerId)?.name || "未設定"}`}
              meta={`${warehouseMap.get(item.warehouseId)?.name || "未設定"} / ${item.receivedDate}`}
              right={formatUnitQuantity(item)}
              badge={item.packageType === "flex" ? "フレコン" : item.packageType === "bag" ? "30kg袋" : "バラ"}
            />
          ))}
        </SectionCard>
      </View>
    ),
    grading: (
      <View className="gap-4">
        <SectionCard title="等級確定" subtitle="未設定在庫を選択して等級を保存">
          <SelectField label="対象在庫" value={gradingUnitId} onChange={setGradingUnitId} options={gradingUnitOptions} />
          <View className="mb-3 flex-row flex-wrap gap-2">
            {gradeOptions.map((grade) => (
              <SelectPill key={grade} label={grade} active={gradingGrade === grade} onPress={() => setGradingGrade(grade)} />
            ))}
          </View>
          <ActionButton label="等級を確定" onPress={confirmGrade} disabled={!gradingUnitId} />
        </SectionCard>

        <SectionCard title="等級待ち在庫">
          {pendingGradingUnits.length === 0 ? (
            <Text className="text-sm text-[#677162]">等級未設定の在庫はありません。</Text>
          ) : (
            pendingGradingUnits.map((item) => (
              <ItemRow
                key={item.id}
                title={`${item.brand} / ${producerMap.get(item.producerId)?.name || "未設定"}`}
                meta={`${warehouseMap.get(item.warehouseId)?.name || "未設定"} / ${item.receivedDate}`}
                right={formatUnitQuantity(item)}
                badge="未設定"
              />
            ))
          )}
        </SectionCard>
      </View>
    ),
    outbound: (
      <View className="gap-4">
        <SectionCard title="出庫登録" subtitle="等級確定済み在庫のみ出庫可能">
          <View className="mb-3 flex-row gap-3">
            <SelectField label="倉庫" value={outboundWarehouseId} onChange={setOutboundWarehouseId} options={warehouseOptions} compact />
            <SelectField
              label="納品先"
              value={outboundDestinationId}
              onChange={setOutboundDestinationId}
              options={destinationOptions}
              compact
            />
          </View>
          <SelectField label="出庫対象" value={outboundUnitId} onChange={setOutboundUnitId} options={outboundUnitOptions} />
          <View className="mb-3 flex-row flex-wrap gap-2">
            <SelectPill label="フレコン単位" active={outboundMode === "flex"} onPress={() => setOutboundMode("flex")} />
            <SelectPill label="30kg袋単位" active={outboundMode === "bag"} onPress={() => setOutboundMode("bag")} />
            <SelectPill label="kg指定" active={outboundMode === "bulk"} onPress={() => setOutboundMode("bulk")} />
          </View>
          <View className="mb-3 flex-row gap-3">
            <Field label="数量" value={outboundQuantity} onChangeText={setOutboundQuantity} compact keyboardType="numeric" />
            <DisplayField
              label="換算kg"
              value={`${(Number(outboundQuantity) || 0) * (outboundMode === "bulk" ? 1 : kgPerUnit(outboundMode))}kg`}
              compact
              hint="自動計算"
            />
          </View>
          <Field label="備考" value={outboundNotes} onChangeText={setOutboundNotes} placeholder="出庫メモ" />
          <ActionButton label="出庫を確定" onPress={registerOutbound} disabled={!outboundUnitId || !outboundDestinationId} />
        </SectionCard>

        <SectionCard title="出庫対象一覧">
          {outboundCandidateUnits.map((item) => (
            <ItemRow
              key={item.id}
              title={`${item.brand} / ${item.grade || "未設定"}`}
              meta={`${warehouseMap.get(item.warehouseId)?.name || "未設定"} / ${producerMap.get(item.producerId)?.name || "未設定"}`}
              right={formatUnitQuantity(item)}
            />
          ))}
        </SectionCard>
      </View>
    ),
    breakdown: (
      <View className="gap-4">
        <SectionCard title="崩し" subtitle="フレコン・袋をバラ在庫へ変換">
          <View className="mb-3 flex-row flex-wrap gap-2">
            <SelectPill label="フレコン崩し" active={breakdownMode === "flex"} onPress={() => setBreakdownMode("flex")} />
            <SelectPill label="袋崩し" active={breakdownMode === "bag"} onPress={() => setBreakdownMode("bag")} />
          </View>
          <SelectField label="対象在庫" value={breakdownUnitId} onChange={setBreakdownUnitId} options={breakdownUnitOptions} />
          <View className="mb-3 flex-row gap-3">
            <Field label="崩す数量" value={breakdownQuantity} onChangeText={setBreakdownQuantity} compact keyboardType="numeric" />
            <DisplayField
              label="生成バラkg"
              value={`${(Number(breakdownQuantity) || 0) * kgPerUnit(breakdownMode)}kg`}
              compact
              hint="自動計算"
            />
          </View>
          <DisplayField label="担当者" value={`${currentUser.name} / ${currentRoleLabel}`} />
          <ActionButton label="バラ在庫を生成" onPress={registerBreakdown} disabled={!breakdownUnitId} />
        </SectionCard>

        <SectionCard title="崩し対象一覧">
          {breakdownCandidateUnits.map((item) => (
            <ItemRow
              key={item.id}
              title={`${item.brand} / ${producerMap.get(item.producerId)?.name || "未設定"}`}
              meta={`${warehouseMap.get(item.warehouseId)?.name || "未設定"} / ${item.grade || "未設定"}`}
              right={formatUnitQuantity(item)}
              badge={breakdownMode === "flex" ? "フレコン" : "袋"}
            />
          ))}
        </SectionCard>
      </View>
    ),
    transfer: (
      <View className="gap-4">
        <SectionCard title="倉庫間移動" subtitle="移動元から減算し移動先へ加算">
          <View className="mb-3 flex-row gap-3">
            <SelectField label="移動元" value={transferFromWarehouseId} onChange={setTransferFromWarehouseId} options={warehouseOptions} compact />
            <SelectField label="移動先" value={transferToWarehouseId} onChange={setTransferToWarehouseId} options={warehouseOptions} compact />
          </View>
          <SelectField label="対象在庫" value={transferUnitId} onChange={setTransferUnitId} options={transferUnitOptions} />
          <View className="mb-3 flex-row flex-wrap gap-2">
            <SelectPill label="フレコン" active={transferMode === "flex"} onPress={() => setTransferMode("flex")} />
            <SelectPill label="袋" active={transferMode === "bag"} onPress={() => setTransferMode("bag")} />
            <SelectPill label="kg" active={transferMode === "bulk"} onPress={() => setTransferMode("bulk")} />
          </View>
          <View className="mb-3 flex-row gap-3">
            <Field label="数量" value={transferQuantity} onChangeText={setTransferQuantity} compact keyboardType="numeric" />
            <DisplayField
              label="換算kg"
              value={`${(Number(transferQuantity) || 0) * (transferMode === "bulk" ? 1 : kgPerUnit(transferMode))}kg`}
              compact
              hint="自動計算"
            />
          </View>
          <ActionButton label="移動を登録" onPress={registerTransfer} disabled={!transferUnitId || !transferToWarehouseId} />
        </SectionCard>

        <SectionCard title="移動可能在庫">
          {transferCandidateUnits.map((item) => (
            <ItemRow
              key={item.id}
              title={`${item.brand} / ${producerMap.get(item.producerId)?.name || "未設定"}`}
              meta={`${warehouseMap.get(item.warehouseId)?.name || "未設定"} / ${item.grade || "未設定"}`}
              right={formatUnitQuantity(item)}
            />
          ))}
        </SectionCard>
      </View>
    ),
    inventory: (
      <View className="gap-4">
        <SectionCard title="在庫確認" subtitle="ローカル保存された在庫を集約表示">
          <View className="mb-3 flex-row gap-3">
            <SelectField
              label="倉庫"
              value={inventoryWarehouseFilter}
              onChange={setInventoryWarehouseFilter}
              options={[{ label: "全倉庫", value: "all" }, ...warehouseOptions]}
              compact
            />
            <SelectField
              label="生産者"
              value={inventoryProducerFilter}
              onChange={setInventoryProducerFilter}
              options={[{ label: "すべて", value: "all" }, ...producerOptions]}
              compact
            />
          </View>
          <View className="mb-3 flex-row gap-3">
            <SelectField
              label="等級"
              value={inventoryGradeFilter}
              onChange={setInventoryGradeFilter}
              options={[{ label: "すべて", value: "all" }, ...gradeOptions.map((item) => ({ label: item, value: item }))]}
              compact
            />
            <DisplayField label="集計件数" value={`${visibleInventorySummary.length}件`} compact hint="自動集計" />
          </View>
          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-sm font-bold text-[#314438]">在庫0を非表示</Text>
            <Switch value={hideZero} onValueChange={setHideZero} trackColor={{ false: "#C9D0DB", true: "#1A8E5F" }} />
          </View>
        </SectionCard>

        <SectionCard title="在庫一覧">
          {visibleInventorySummary.map((item) => (
            <ItemRow
              key={`${item.warehouseId}-${item.producerId}-${item.brand}-${item.grade}`}
              title={`${item.brand} / ${item.grade}`}
              meta={`${item.warehouseName} / ${item.producerName}`}
              right={`フレコン ${item.flexCount}本 / 袋 ${item.bagCount}袋 / バラ ${item.bulkKg}kg`}
            />
          ))}
        </SectionCard>
      </View>
    ),
    master: (
      <View className="gap-4">
        <SectionCard title="CSV一括登録" subtitle="テンプレートを元にローカル取込する想定UI">
          <View className="mb-3 flex-row flex-wrap gap-2">
            <SelectPill
              label="生産者CSV"
              active={csvImportTarget === "producers"}
              onPress={() => setCsvImportTarget("producers")}
            />
            <SelectPill
              label="納品先CSV"
              active={csvImportTarget === "destinations"}
              onPress={() => setCsvImportTarget("destinations")}
            />
            <SelectPill
              label="倉庫CSV"
              active={csvImportTarget === "warehouses"}
              onPress={() => setCsvImportTarget("warehouses")}
            />
          </View>
          <DisplayField label="インポート対象" value={csvTemplateMap[csvImportTarget].fileName} hint="テンプレート" />
          <Field label="取込メモ" value={csvStatusMessage} />
          <View className="mt-1.5 flex-row flex-wrap gap-2.5">
            <ActionButton label="CSVを選択して登録" onPress={handleCsvImport} />
            <ActionButton label="テンプレートCSVを取得" onPress={handleTemplateDownload} variant="secondary" />
            <ActionButton label="テンプレート確認" onPress={handleCsvTemplatePreview} variant="secondary" />
          </View>
        </SectionCard>

        <SectionCard title="インポート用テンプレート" subtitle="現在選択中のCSVテンプレート内容">
          <View className="rounded-2xl border border-[#E4DBCD] bg-[#F8F4ED] p-3">
            <Text className="text-xs leading-5 text-[#314438]">{csvTemplatePreview}</Text>
          </View>
        </SectionCard>

        <SectionCard title="生産者登録" subtitle="入庫画面のプルダウン元データ">
          <View className="mb-3 flex-row gap-3">
            <Field label="名称" value={producerForm.name} onChangeText={(value) => setProducerForm((prev) => ({ ...prev, name: value }))} compact />
            <Field label="ふりがな" value={producerForm.kana} onChangeText={(value) => setProducerForm((prev) => ({ ...prev, kana: value }))} compact />
          </View>
          <Field label="住所" value={producerForm.address} onChangeText={(value) => setProducerForm((prev) => ({ ...prev, address: value }))} />
          <Field
            label="インボイス番号"
            value={producerForm.invoiceNumber}
            onChangeText={(value) => setProducerForm((prev) => ({ ...prev, invoiceNumber: value }))}
          />
          <Field label="電話番号" value={producerForm.phone} onChangeText={(value) => setProducerForm((prev) => ({ ...prev, phone: value }))} />
          <Field label="備考" value={producerForm.notes} onChangeText={(value) => setProducerForm((prev) => ({ ...prev, notes: value }))} />
          <View className="mt-1.5 flex-row flex-wrap gap-2.5">
            <ActionButton label="生産者を登録" onPress={saveProducer} />
          </View>
        </SectionCard>

        <SectionCard title="納品先登録" subtitle="出庫画面のプルダウン元データ">
          <View className="mb-3 flex-row gap-3">
            <Field
              label="納品先名"
              value={destinationForm.name}
              onChangeText={(value) => setDestinationForm((prev) => ({ ...prev, name: value }))}
              compact
            />
            <Field
              label="担当窓口"
              value={destinationForm.contactPerson}
              onChangeText={(value) => setDestinationForm((prev) => ({ ...prev, contactPerson: value }))}
              compact
            />
          </View>
          <Field label="住所" value={destinationForm.address} onChangeText={(value) => setDestinationForm((prev) => ({ ...prev, address: value }))} />
          <Field label="電話番号" value={destinationForm.phone} onChangeText={(value) => setDestinationForm((prev) => ({ ...prev, phone: value }))} />
          <Field label="備考" value={destinationForm.notes} onChangeText={(value) => setDestinationForm((prev) => ({ ...prev, notes: value }))} />
          <View className="mt-1.5 flex-row flex-wrap gap-2.5">
            <ActionButton label="納品先を登録" onPress={saveDestination} />
          </View>
        </SectionCard>

        <SectionCard title="倉庫登録" subtitle="入庫・出庫・移動画面のプルダウン元データ">
          <View className="mb-3 flex-row gap-3">
            <Field label="倉庫名" value={warehouseForm.name} onChangeText={(value) => setWarehouseForm((prev) => ({ ...prev, name: value }))} compact />
            <Field label="倉庫区分" value={warehouseForm.type} onChangeText={(value) => setWarehouseForm((prev) => ({ ...prev, type: value }))} compact />
          </View>
          <Field label="所在地" value={warehouseForm.address} onChangeText={(value) => setWarehouseForm((prev) => ({ ...prev, address: value }))} />
          <Field
            label="容量(kg)"
            value={warehouseForm.capacityKg}
            onChangeText={(value) => setWarehouseForm((prev) => ({ ...prev, capacityKg: value }))}
            keyboardType="numeric"
          />
          <Field label="備考" value={warehouseForm.notes} onChangeText={(value) => setWarehouseForm((prev) => ({ ...prev, notes: value }))} />
          <View className="mt-1.5 flex-row flex-wrap gap-2.5">
            <ActionButton label="倉庫を登録" onPress={saveWarehouse} />
          </View>
        </SectionCard>

        <SectionCard title="登録済みマスタ一覧">
          {appData.producers.map((item) => (
            <ItemRow key={item.id} title={item.name} meta="生産者マスタ" right={item.phone || "電話未設定"} />
          ))}
          {appData.destinations.map((item) => (
            <ItemRow key={item.id} title={item.name} meta="納品先マスタ" right={item.contactPerson || "担当未設定"} />
          ))}
          {appData.warehouses.map((item) => (
            <ItemRow key={item.id} title={item.name} meta="倉庫マスタ" right={`${item.type} / ${item.capacityKg}kg`} />
          ))}
        </SectionCard>
      </View>
    ),
    login: (
      <View className="gap-4">
        <SectionCard title="ログイン" subtitle="役割ごとの操作権限を切り替え">
          <SelectField
            label="ログインユーザー"
            value={currentUserId}
            onChange={setCurrentUserId}
            options={users.map((user) => ({
              label: `${user.name} / ${roleLabels[user.role]}`,
              value: user.id,
              description: user.warehouseId ? `${warehouseMap.get(user.warehouseId)?.name || "未設定倉庫"} 担当` : "全倉庫を管理",
            }))}
          />
          <DisplayField label="ユーザーID" value={currentUser.loginId} />
          <DisplayField label="表示名" value={currentUser.name} />
          <DisplayField label="ロール" value={currentRoleLabel} />
          <DisplayField
            label="担当倉庫"
            value={currentUser.warehouseId ? warehouseMap.get(currentUser.warehouseId)?.name || "未設定倉庫" : "全倉庫"}
            hint={currentUser.role === "admin" ? "全体管理" : "担当倉庫のみ"}
          />
        </SectionCard>

        <SectionCard title="ローカル保存データ">
          <ItemRow title="保存先" meta="AsyncStorage" right={STORAGE_KEY} />
          <ItemRow title="在庫単位" meta="inventoryUnits" right={`${activeUnits.length}件`} />
          <ItemRow title="操作履歴" meta="movements" right={`${visibleMovements.length}件`} />
          <View className="mt-2 flex-row flex-wrap gap-2.5">
            <ActionButton label="初期データへ戻す" onPress={resetStorage} variant="secondary" disabled={currentUser.role !== "admin"} />
          </View>
        </SectionCard>
      </View>
    ),
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F3EFE7]">
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 bg-[#F3EFE7]">
        <View className="flex-row items-center justify-between border-b border-[#E2D8C7] bg-[#F7F2EA] px-5 pb-3.5 pt-[18px]">
          <View>
            <Text className="text-[28px] font-extrabold text-[#1C3328]">米倉庫管理</Text>
            <Text className="mt-1 text-[13px] text-[#6D756B]">React Native UI Mock for warehouse operations</Text>
            <Text className="mt-1 text-[13px] font-bold text-[#2D5A45]">
              {currentRoleLabel}
              {currentUser.warehouseId ? ` / ${warehouseMap.get(currentUser.warehouseId)?.name || "未設定倉庫"}` : " / 全倉庫"}
            </Text>
          </View>
          <View className="rounded-full bg-[#1C3328] px-3 py-2">
            <Text className="text-xs font-bold text-[#F6F0E7]">{hydrated ? "Local Ready" : "Loading"}</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="h-[76px] bg-[#EFE6D8]"
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10, alignItems: "center" }}
        >
          {screens.map((screen) => (
            <Pressable
              key={screen.key}
              disabled={!allowedScreens.includes(screen.key)}
              className={
                !allowedScreens.includes(screen.key)
                  ? "flex-none h-[52px] min-w-[120px] items-center justify-center rounded-2xl border border-[#D9D4CB] bg-[#ECE5DA] px-4 opacity-45"
                  : currentScreen === screen.key
                    ? "flex-none h-[52px] min-w-[120px] items-center justify-center rounded-2xl border border-[#1A8E5F] bg-[#1A8E5F] px-4"
                    : "flex-none h-[52px] min-w-[120px] items-center justify-center rounded-2xl border border-[#DED3C0] bg-[#FBF8F2] px-4"
              }
              onPress={() => {
                if (!allowedScreens.includes(screen.key)) {
                  return;
                }
                setCurrentScreen(screen.key);
              }}
            >
              <Text
                className={
                  !allowedScreens.includes(screen.key)
                    ? "text-[15px] font-bold leading-[18px] text-[#8E918C]"
                    : currentScreen === screen.key
                    ? "text-[15px] font-bold leading-[18px] text-white"
                    : "text-[15px] font-bold leading-[18px] text-[#284436]"
                }
                numberOfLines={1}
              >
                {screen.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="px-5 pb-2 pt-[18px]">
          <Text className="text-2xl font-extrabold text-[#233729]">{activeScreen.label}</Text>
          <Text className="mt-1.5 text-[13px] leading-5 text-[#677162]">
            ローカルストレージ保存対応。マスタ、在庫、履歴を端末内に保持します。
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {screenMap[currentScreen]}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
