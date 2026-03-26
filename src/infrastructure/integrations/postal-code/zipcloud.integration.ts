import { z } from 'zod';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type {
	PostalCodeAddress,
	PostalCodeIntegration,
} from '~/application/ports/integrations/postal-code/postal-code.integration';

/** zipcloud API のレスポンス構造 */
const zipCloudResultSchema = z.object({
	address1: z.string(), // 都道府県
	address2: z.string(), // 市区町村
	address3: z.string(), // 町域
});

const zipCloudResponseSchema = z.object({
	results: z.array(zipCloudResultSchema).nullable(),
});

/**
 * zipcloud を使った PostalCodeIntegration の具象実装
 *
 * https://zipcloud.ibsnet.co.jp/api/search で郵便番号を検索する。
 * 認証不要の無料 API。
 */
export class ZipCloudPostalCodeIntegration implements PostalCodeIntegration {
	public async lookup(zipCode: string): Promise<PostalCodeAddress | null> {
		try {
			const normalized = zipCode.replace('-', '');
			const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${normalized}`);
			const json: unknown = await response.json();
			const parsed = zipCloudResponseSchema.parse(json);
			const first = parsed.results?.[0];
			if (!first) {
				return null;
			}
			return {
				prefecture: first.address1,
				city: first.address2,
				town: first.address3,
			};
		} catch (error) {
			const message = (() => {
				if (error instanceof Error) {
					return error.message;
				} else {
					return String(error);
				}
			})();
			throw new InfrastructureError(`ZipCloud API エラー: ${message}`);
		}
	}
}
