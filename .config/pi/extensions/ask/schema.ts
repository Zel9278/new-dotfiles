/** ask / ask_multi 共通の選択肢スキーマ。 */

import { Type } from "typebox";

export const OptionSchema = Type.Object({
	label: Type.String({ description: "Display label for the option" }),
	description: Type.Optional(
		Type.String({ description: "Optional description shown under the label" }),
	),
});
