/**
 * 郵便番号から住所を取得する統合のインターフェース
 */
export interface PostalCodeAddress {
	/** 都道府県 */
	readonly prefecture: string;
	/** 市区町村 */
	readonly city: string;
	/** 町域 */
	readonly town: string;
}

export interface PostalCodeIntegration {
	/**
	 * 郵便番号から住所を検索する
	 *
	 * @param zipCode 郵便番号 (ハイフンあり・なし両方可)
	 * @returns 住所情報、見つからない場合は null
	 */
	lookup(zipCode: string): Promise<PostalCodeAddress | null>;
}
