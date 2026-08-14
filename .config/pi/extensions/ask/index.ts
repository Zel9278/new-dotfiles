/**
 * Ask Extension
 *
 * エージェントが ced に選択肢を提示して選ばせるツール。
 * 「どっちにする?」を文章で聞く代わりに、pi のダイアログで選べるようにする。
 *
 * - ask       : 単一選択。自由入力欄付き
 * - ask_multi : 複数選択。スペースでトグル
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAskMulti } from "./ask-multi.ts";
import { registerAsk } from "./ask.ts";

export default function ask(pi: ExtensionAPI) {
	registerAsk(pi);
	registerAskMulti(pi);
}
