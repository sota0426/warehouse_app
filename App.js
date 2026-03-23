import React, { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";

const screens = [
  { key: "dashboard", label: "ホーム" },
  { key: "inbound", label: "入庫" },
  { key: "grading", label: "等級確定" },
  { key: "outbound", label: "出庫" },
  { key: "breakdown", label: "フレコン崩し" },
  { key: "transfer", label: "倉庫移動" },
  { key: "inventory", label: "在庫確認" },
  { key: "master", label: "マスタ" },
  { key: "login", label: "ログイン" },
];

const warehouses = ["第1倉庫", "第2倉庫", "低温倉庫"];
const producers = ["田中農園", "山本ライス", "青木アグリ"];
const brands = ["コシヒカリ", "ひとめぼれ", "あきたこまち"];
const grades = ["未設定", "特A", "A", "B"];
const staff = ["佐藤", "高橋", "伊藤"];
const destinations = ["地場スーパー", "業務卸A", "学校給食センター"];

const inboundUnits = [
  {
    id: "IU-240301-01",
    warehouse: "第1倉庫",
    producer: "田中農園",
    brand: "コシヒカリ",
    quantity: "4本 / 4320kg",
    packageType: "フレコン",
    grade: "未設定",
  },
  {
    id: "IU-240301-02",
    warehouse: "低温倉庫",
    producer: "山本ライス",
    brand: "ひとめぼれ",
    quantity: "720kg",
    packageType: "バラ",
    grade: "A",
  },
  {
    id: "IU-240302-01",
    warehouse: "第2倉庫",
    producer: "青木アグリ",
    brand: "あきたこまち",
    quantity: "20袋 / 600kg",
    packageType: "30kg袋",
    grade: "未設定",
  },
];

const movementHistory = [
  { type: "出庫", date: "2026-03-21 09:10", detail: "第1倉庫 コシヒカリ 2本", user: "佐藤" },
  { type: "移動", date: "2026-03-21 13:40", detail: "第2倉庫 -> 低温倉庫 540kg", user: "高橋" },
  { type: "入庫", date: "2026-03-22 08:15", detail: "青木アグリ あきたこまち 600kg", user: "伊藤" },
];

const inventorySummary = [
  { warehouse: "第1倉庫", brand: "コシヒカリ", grade: "特A", flex: "14本", bulk: "180kg" },
  { warehouse: "第2倉庫", brand: "あきたこまち", grade: "A", flex: "3本", bulk: "90kg" },
  { warehouse: "低温倉庫", brand: "ひとめぼれ", grade: "A", flex: "0本", bulk: "920kg" },
];

function SectionCard({ title, subtitle, children, tone = "default" }) {
  const isAccent = tone === "accent";

  return (
    <View style={[styles.card, isAccent && styles.cardAccent]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, isAccent && styles.cardTitleAccent]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.cardSubtitle, isAccent && styles.cardSubtitleAccent]}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Field({ label, placeholder, value, compact = false }) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} placeholder={placeholder} placeholderTextColor="#8C94A6" style={styles.input} />
    </View>
  );
}

function SelectPill({ label, active = false }) {
  return (
    <Pressable style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({ label, variant = "primary" }) {
  return (
    <Pressable style={[styles.button, variant === "secondary" && styles.buttonSecondary]}>
      <Text style={[styles.buttonText, variant === "secondary" && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function StatTile({ label, value, note }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statNote}>{note}</Text>
    </View>
  );
}

function ItemRow({ title, meta, right, badge }) {
  return (
    <View style={styles.rowItem}>
      <View style={styles.rowMain}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      <Text style={styles.rowRight}>{right}</Text>
    </View>
  );
}

function DashboardScreen() {
  return (
    <View style={styles.screenBody}>
      <SectionCard title="本日の状況" subtitle="現場で必要な数値を先頭に集約" tone="accent">
        <View style={styles.statGrid}>
          <StatTile label="入庫予定" value="3件" note="未処理 1件" />
          <StatTile label="等級待ち" value="5件" note="要確認 2件" />
          <StatTile label="出庫依頼" value="4件" note="本日締切 1件" />
          <StatTile label="競合警告" value="1件" note="更新確認" />
        </View>
      </SectionCard>

      <SectionCard title="今日の優先作業">
        <View style={styles.inlineGroup}>
          <SelectPill label="入庫登録へ" active />
          <SelectPill label="等級確定へ" />
          <SelectPill label="在庫確認へ" />
        </View>
      </SectionCard>

      <SectionCard title="最新の操作履歴" subtitle="stock_movements の想定 UI">
        {movementHistory.map((item) => (
          <ItemRow
            key={`${item.type}-${item.date}`}
            title={item.type}
            meta={`${item.date} / ${item.user}`}
            right={item.detail}
          />
        ))}
      </SectionCard>
    </View>
  );
}

function InboundScreen() {
  return (
    <View style={styles.screenBody}>
      <SectionCard title="入庫登録" subtitle="kg 換算前提の入力UI">
        <View style={styles.twoColumn}>
          <Field label="入庫日" value="2026-03-23" compact />
          <Field label="担当者" value={staff[0]} compact />
        </View>
        <Field label="倉庫" value={warehouses[0]} />
        <Field label="生産者" value={producers[0]} />
        <Field label="銘柄" value={brands[0]} />
        <View style={styles.twoColumn}>
          <Field label="数量" value="4" compact />
          <Field label="kg換算" value="4320kg" compact />
        </View>
        <View style={styles.inlineGroup}>
          <SelectPill label="フレコン" active />
          <SelectPill label="30kg袋" />
          <SelectPill label="バラ" />
        </View>
        <Field label="備考" placeholder="検査前。等級未設定で登録" value="" />
        <View style={styles.buttonRow}>
          <ActionButton label="在庫単位を生成" />
          <ActionButton label="下書き保存" variant="secondary" />
        </View>
      </SectionCard>

      <SectionCard title="直近の入庫候補">
        {inboundUnits.map((item) => (
          <ItemRow
            key={item.id}
            title={`${item.brand} / ${item.producer}`}
            meta={`${item.id} / ${item.warehouse}`}
            right={item.quantity}
            badge={item.packageType}
          />
        ))}
      </SectionCard>
    </View>
  );
}

function GradingScreen() {
  return (
    <View style={styles.screenBody}>
      <SectionCard title="等級確定" subtitle="未設定在庫を対象に付与">
        <Field label="検索" value="第1倉庫 / コシヒカリ" />
        <View style={styles.inlineGroup}>
          {grades.map((grade, index) => (
            <SelectPill key={grade} label={grade} active={index === 1} />
          ))}
        </View>
        <View style={styles.buttonRow}>
          <ActionButton label="等級を確定" />
          <ActionButton label="バラ在庫を統合" variant="secondary" />
        </View>
      </SectionCard>

      <SectionCard title="対象在庫">
        {inboundUnits
          .filter((item) => item.grade === "未設定")
          .map((item) => (
            <ItemRow
              key={item.id}
              title={`${item.brand} / ${item.producer}`}
              meta={`${item.warehouse} / ${item.packageType}`}
              right={item.quantity}
              badge="未設定"
            />
          ))}
      </SectionCard>
    </View>
  );
}

function OutboundScreen() {
  return (
    <View style={styles.screenBody}>
      <SectionCard title="出庫登録" subtitle="等級確定済みのみ選択可能">
        <View style={styles.twoColumn}>
          <Field label="倉庫" value={warehouses[0]} compact />
          <Field label="納品先" value={destinations[0]} compact />
        </View>
        <Field label="検索" value="特A / コシヒカリ" />
        <View style={styles.inlineGroup}>
          <SelectPill label="フレコン単位" active />
          <SelectPill label="30kg袋単位" />
          <SelectPill label="kg指定" />
        </View>
        <View style={styles.twoColumn}>
          <Field label="数量" value="2本" compact />
          <Field label="換算kg" value="2160kg" compact />
        </View>
        <Field label="備考" placeholder="出庫メモ" value="" />
        <ActionButton label="出庫を確定" />
      </SectionCard>

      <SectionCard title="出庫対象一覧">
        {inventorySummary.map((item) => (
          <ItemRow
            key={`${item.warehouse}-${item.brand}`}
            title={`${item.brand} / ${item.grade}`}
            meta={item.warehouse}
            right={`${item.flex} / ${item.bulk}`}
          />
        ))}
      </SectionCard>
    </View>
  );
}

function BreakdownScreen() {
  return (
    <View style={styles.screenBody}>
      <SectionCard title="フレコン崩し" subtitle="フルフレコンをバラ在庫へ変換">
        <Field label="対象倉庫" value={warehouses[1]} />
        <Field label="対象在庫" value="あきたこまち / A / フルフレコン" />
        <View style={styles.twoColumn}>
          <Field label="崩す本数" value="1本" compact />
          <Field label="生成バラkg" value="1080kg" compact />
        </View>
        <Field label="担当者" value={staff[1]} />
        <ActionButton label="バラ在庫を生成" />
      </SectionCard>

      <SectionCard title="変換後プレビュー">
        <ItemRow title="減少" meta="フルフレコン在庫" right="-1本" />
        <ItemRow title="増加" meta="同一銘柄のバラ在庫" right="+1080kg" />
      </SectionCard>
    </View>
  );
}

function TransferScreen() {
  return (
    <View style={styles.screenBody}>
      <SectionCard title="倉庫間移動" subtitle="移動元から減算し移動先へ加算">
        <View style={styles.twoColumn}>
          <Field label="移動元" value={warehouses[0]} compact />
          <Field label="移動先" value={warehouses[2]} compact />
        </View>
        <Field label="対象在庫" value="コシヒカリ / 特A" />
        <View style={styles.inlineGroup}>
          <SelectPill label="フレコン" active />
          <SelectPill label="袋" />
          <SelectPill label="kg" />
        </View>
        <View style={styles.twoColumn}>
          <Field label="数量" value="1本" compact />
          <Field label="換算kg" value="1080kg" compact />
        </View>
        <ActionButton label="移動を登録" />
      </SectionCard>

      <SectionCard title="移動履歴プレビュー">
        {movementHistory
          .filter((item) => item.type === "移動")
          .map((item) => (
            <ItemRow key={item.date} title={item.type} meta={item.date} right={item.detail} />
          ))}
      </SectionCard>
    </View>
  );
}

function InventoryScreen() {
  const [hideZero, setHideZero] = useState(true);

  const visibleRows = useMemo(() => {
    if (!hideZero) {
      return inventorySummary;
    }
    return inventorySummary.filter((item) => item.flex !== "0本" || item.bulk !== "0kg");
  }, [hideZero]);

  return (
    <View style={styles.screenBody}>
      <SectionCard title="在庫確認" subtitle="倉庫・銘柄・等級ごとの集約表示">
        <View style={styles.filterBar}>
          <Field label="倉庫" value="全倉庫" compact />
          <Field label="銘柄" value="全銘柄" compact />
        </View>
        <View style={styles.filterBar}>
          <Field label="生産者" value="すべて" compact />
          <Field label="等級" value="すべて" compact />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>在庫0を非表示</Text>
          <Switch value={hideZero} onValueChange={setHideZero} trackColor={{ false: "#C9D0DB", true: "#1A8E5F" }} />
        </View>
      </SectionCard>

      <SectionCard title="在庫一覧">
        {visibleRows.map((item) => (
          <ItemRow
            key={`${item.warehouse}-${item.brand}-${item.grade}`}
            title={`${item.brand} / ${item.grade}`}
            meta={item.warehouse}
            right={`${item.flex} / ${item.bulk}`}
          />
        ))}
      </SectionCard>
    </View>
  );
}

function MasterScreen() {
  return (
    <View style={styles.screenBody}>
      <SectionCard title="マスタ管理" subtitle="選択式中心の運用を想定">
        <View style={styles.inlineGroup}>
          <SelectPill label="生産者" active />
          <SelectPill label="銘柄" />
          <SelectPill label="等級" />
          <SelectPill label="担当者" />
          <SelectPill label="倉庫" />
          <SelectPill label="納品先" />
        </View>
        <View style={styles.twoColumn}>
          <Field label="名称" value="田中農園" compact />
          <Field label="ふりがな" value="たなかのうえん" compact />
        </View>
        <Field label="住所" value="新潟県南魚沼市..." />
        <Field label="インボイス番号" value="T1234567890123" />
        <View style={styles.buttonRow}>
          <ActionButton label="新規登録" />
          <ActionButton label="一覧を開く" variant="secondary" />
        </View>
      </SectionCard>

      <SectionCard title="マスタ一覧">
        {producers.map((producer, index) => (
          <ItemRow key={producer} title={producer} meta="生産者マスタ" right={`担当 ${staff[index] || staff[0]}`} />
        ))}
      </SectionCard>
    </View>
  );
}

function LoginScreen() {
  return (
    <View style={styles.screenBody}>
      <SectionCard title="ログイン" subtitle="操作ユーザー記録の起点">
        <Field label="ユーザーID" value="warehouse-admin" />
        <Field label="パスワード" value="••••••••" />
        <View style={styles.inlineGroup}>
          <SelectPill label="現場担当" active />
          <SelectPill label="管理者" />
          <SelectPill label="閲覧のみ" />
        </View>
        <ActionButton label="ログイン" />
      </SectionCard>

      <SectionCard title="同時操作対策">
        <ItemRow title="楽観ロック" meta="updatedAt 比較" right="有効" />
        <ItemRow title="競合表示" meta="更新時エラー" right="モーダル通知" />
      </SectionCard>
    </View>
  );
}

function App() {
  const [currentScreen, setCurrentScreen] = useState("dashboard");

  const activeScreen = useMemo(
    () => screens.find((screen) => screen.key === currentScreen) || screens[0],
    [currentScreen]
  );

  const screenMap = {
    dashboard: <DashboardScreen />,
    inbound: <InboundScreen />,
    grading: <GradingScreen />,
    outbound: <OutboundScreen />,
    breakdown: <BreakdownScreen />,
    transfer: <TransferScreen />,
    inventory: <InventoryScreen />,
    master: <MasterScreen />,
    login: <LoginScreen />,
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" />
      <View style={styles.appShell}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.appTitle}>米倉庫管理</Text>
            <Text style={styles.appSubtitle}>React Native UI Mock for warehouse operations</Text>
          </View>
          <View style={styles.liveChip}>
            <Text style={styles.liveChipText}>UI Only</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navScrollContent}
          style={styles.navStrip}
        >
          {screens.map((screen) => (
            <Pressable
              key={screen.key}
              style={[styles.navItem, currentScreen === screen.key && styles.navItemActive]}
              onPress={() => setCurrentScreen(screen.key)}
            >
              <Text style={[styles.navItemText, currentScreen === screen.key && styles.navItemTextActive]}>
                {screen.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>{activeScreen.label}</Text>
          <Text style={styles.screenDescription}>
            業務処理は未接続。要件確認用に画面構成のみ作成しています。
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {screenMap[currentScreen]}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3EFE7",
  },
  appShell: {
    flex: 1,
    backgroundColor: "#F3EFE7",
  },
  topBar: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F2EA",
    borderBottomWidth: 1,
    borderBottomColor: "#E2D8C7",
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1C3328",
  },
  appSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6D756B",
  },
  liveChip: {
    backgroundColor: "#1C3328",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  liveChipText: {
    color: "#F6F0E7",
    fontWeight: "700",
    fontSize: 12,
  },
  navStrip: {
    maxHeight: 62,
    backgroundColor: "#EFE6D8",
  },
  navScrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  navItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#FBF8F2",
    borderWidth: 1,
    borderColor: "#DED3C0",
  },
  navItemActive: {
    backgroundColor: "#1A8E5F",
    borderColor: "#1A8E5F",
  },
  navItemText: {
    color: "#284436",
    fontSize: 14,
    fontWeight: "700",
  },
  navItemTextActive: {
    color: "#FFFFFF",
  },
  screenHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#233729",
  },
  screenDescription: {
    marginTop: 6,
    color: "#677162",
    fontSize: 13,
    lineHeight: 20,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  screenBody: {
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFDFC",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E4DBCD",
    shadowColor: "#8A7B66",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 2,
  },
  cardAccent: {
    backgroundColor: "#1C3328",
    borderColor: "#1C3328",
  },
  cardHeader: {
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#223427",
  },
  cardTitleAccent: {
    color: "#F7F3EC",
  },
  cardSubtitle: {
    marginTop: 4,
    color: "#697467",
    lineHeight: 20,
    fontSize: 13,
  },
  cardSubtitleAccent: {
    color: "#C5D8CD",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statTile: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statLabel: {
    marginTop: 6,
    fontSize: 14,
    color: "#E5F2EB",
    fontWeight: "700",
  },
  statNote: {
    marginTop: 4,
    fontSize: 12,
    color: "#B8D4C5",
  },
  field: {
    marginBottom: 12,
  },
  fieldCompact: {
    flex: 1,
    marginBottom: 0,
  },
  fieldLabel: {
    marginBottom: 6,
    color: "#485447",
    fontWeight: "700",
    fontSize: 13,
  },
  input: {
    height: 48,
    backgroundColor: "#F8F4ED",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCCFBE",
    paddingHorizontal: 14,
    color: "#203126",
    fontSize: 15,
  },
  twoColumn: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  inlineGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    backgroundColor: "#F4EBDD",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#DECFBA",
  },
  pillActive: {
    backgroundColor: "#E2F1E9",
    borderColor: "#1A8E5F",
  },
  pillText: {
    color: "#586656",
    fontWeight: "700",
  },
  pillTextActive: {
    color: "#1A8E5F",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A8E5F",
  },
  buttonSecondary: {
    backgroundColor: "#EEF3EF",
    borderWidth: 1,
    borderColor: "#C8D8CF",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  buttonTextSecondary: {
    color: "#255841",
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEE5D9",
    gap: 12,
  },
  rowMain: {
    flex: 1,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#223327",
  },
  rowMeta: {
    marginTop: 4,
    color: "#717B73",
    fontSize: 12,
  },
  rowRight: {
    flexShrink: 1,
    textAlign: "right",
    color: "#2C493A",
    fontWeight: "700",
    fontSize: 13,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "#F2E5CF",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#7A5721",
    fontWeight: "700",
    fontSize: 11,
  },
  filterBar: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  switchRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#314438",
  },
});

export default App;
