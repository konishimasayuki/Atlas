// 各モジュールの入口コンポーネントを登録する表。
// 担当者は自分のモジュールを作ったらここに1行追加するだけ。
import SalesModule from "./sales/index.jsx";
import HrModule from "./hr/index.jsx";
import InventoryModule from "./inventory/index.jsx";

export const MODULE_COMPONENTS = {
  sales: SalesModule,
  hr: HrModule,
  inventory: InventoryModule,
  // ga: GaModule,
};
