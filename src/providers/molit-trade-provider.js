import { PriceDataProvider } from "./price-provider.js";

export class MolitTradeProvider extends PriceDataProvider {
  syncRegion() {
    throw new Error("MOLIT provider is planned for commercial migration and is not implemented yet.");
  }
}

