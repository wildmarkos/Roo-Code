declare module "puppeteer-chromium-resolver" {
	import { Browser } from "puppeteer-core"

	interface PCROptions {
		downloadPath: string
	}

	interface PCRStats {
		puppeteer: {
			launch: (options?: any) => Promise<Browser>
		}
		executablePath: string
	}

	function PCR(options: PCROptions): Promise<PCRStats>
	export = PCR
}
