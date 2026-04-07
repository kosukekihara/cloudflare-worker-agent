/** 現在時刻を JST の日時文字列 (YYYY年MM月DD日 HH:MM) に変換する */
export function buildJstDateTimeString(): string {
	const now = new Date();
	const jstOffsetMs = 9 * 60 * 60 * 1000;
	const jst = new Date(now.getTime() + jstOffsetMs);
	const year = jst.getUTCFullYear();
	const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
	const day = String(jst.getUTCDate()).padStart(2, '0');
	const hours = String(jst.getUTCHours()).padStart(2, '0');
	const minutes = String(jst.getUTCMinutes()).padStart(2, '0');
	return `${year}年${month}月${day}日 ${hours}:${minutes}`;
}
