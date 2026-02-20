import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import fs from "node:fs/promises"
import path from "node:path"

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[]
    store_id: string
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => ({
              currency_code: currency.currency_code,
              is_default: currency.is_default ?? false,
            })
          ),
        },
      }
    })

    const stores = updateStoresStep(normalizedInput)

    return new WorkflowResponse(stores)
  }
)

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const storeModuleService = container.resolve(Modules.STORE)

  const countries = ["us"]

  logger.info("Seeding store data...")
  const [store] = await storeModuleService.listStores()
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })

  if (!defaultSalesChannel.length) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    })
    defaultSalesChannel = salesChannelResult
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        {
          currency_code: "usd",
          is_default: true,
        },
      ],
    },
  })

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  })

  logger.info("Seeding region data...")
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "United States",
          currency_code: "usd",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  })
  const region = regionResult[0]
  logger.info("Finished seeding regions.")

  logger.info("Seeding tax regions...")
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  })
  logger.info("Finished seeding tax regions.")

  logger.info("Seeding stock location data...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Vivero Central",
          address: {
            city: "Miami",
            country_code: "US",
            address_1: "1200 Greenhouse Ave",
          },
        },
      ],
    },
  })
  const stockLocation = stockLocationResult[0]

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  })

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  })

  logger.info("Seeding fulfillment data...")
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      })
    shippingProfile = shippingProfileResult[0]
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "US Plants Delivery",
    type: "shipping",
    service_zones: [
      {
        name: "United States",
        geo_zones: [
          {
            country_code: "us",
            type: "country",
          },
        ],
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  })

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Envio estandar",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Estandar",
          description: "Entrega en 3 a 5 dias habiles.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 900,
          },
          {
            region_id: region.id,
            amount: 900,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Envio rapido",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Rapido",
          description: "Entrega en 24 a 48 horas.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 1900,
          },
          {
            region_id: region.id,
            amount: 1900,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  })
  logger.info("Finished seeding fulfillment data.")

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  })
  logger.info("Finished seeding stock location data.")

  logger.info("Seeding publishable API key data...")
  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Plantas Storefront",
          type: "publishable",
          created_by: "seed-script",
        },
      ],
    },
  })

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  })

  const publishableKeyToken =
    (publishableApiKey as { token?: string; id?: string }).token ??
    publishableApiKey.id

  const publishableKeyFile = process.env.PUBLISHABLE_KEY_FILE
  if (publishableKeyFile && publishableKeyToken) {
    await fs.mkdir(path.dirname(publishableKeyFile), { recursive: true })
    await fs.writeFile(publishableKeyFile, publishableKeyToken, "utf8")
    logger.info(`Publishable API key written to ${publishableKeyFile}`)
  }
  logger.info("Finished seeding publishable API key data.")

  logger.info("Seeding product data...")

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Plantas de interior",
          is_active: true,
        },
        {
          name: "Plantas de exterior",
          is_active: true,
        },
        {
          name: "Macetas y sustratos",
          is_active: true,
        },
      ],
    },
  })

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Monstera Deliciosa",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Plantas de interior")!.id,
          ],
          description:
            "Planta tropical de interior con hojas grandes y brillantes. Ideal para salas con luz indirecta.",
          handle: "monstera-deliciosa",
          weight: 1200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1632207691143-643e2a7c0600?auto=format&fit=crop&w=1200&q=80",
            },
          ],
          options: [
            {
              title: "Formato",
              values: ["Maceta 15 cm"],
            },
          ],
          variants: [
            {
              title: "Maceta 15 cm",
              sku: "PLANT-MONSTERA-15",
              options: {
                Formato: "Maceta 15 cm",
              },
              prices: [
                {
                  amount: 3499,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Ficus Lyrata",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Plantas de interior")!.id,
          ],
          description:
            "Ficus de hojas anchas y elegantes para espacios luminosos. Muy decorativo para oficinas y hogares.",
          handle: "ficus-lyrata",
          weight: 1400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1631377819268-d716cd6104d2?auto=format&fit=crop&w=1200&q=80",
            },
          ],
          options: [
            {
              title: "Formato",
              values: ["Maceta 17 cm"],
            },
          ],
          variants: [
            {
              title: "Maceta 17 cm",
              sku: "PLANT-FICUS-17",
              options: {
                Formato: "Maceta 17 cm",
              },
              prices: [
                {
                  amount: 4299,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Lavanda",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Plantas de exterior")!.id,
          ],
          description:
            "Planta aromatica resistente al sol, perfecta para balcones y jardines con riego moderado.",
          handle: "lavanda",
          weight: 900,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1591389703632-4b5f0ed66950?auto=format&fit=crop&w=1200&q=80",
            },
          ],
          options: [
            {
              title: "Formato",
              values: ["Maceta 12 cm"],
            },
          ],
          variants: [
            {
              title: "Maceta 12 cm",
              sku: "PLANT-LAVANDA-12",
              options: {
                Formato: "Maceta 12 cm",
              },
              prices: [
                {
                  amount: 1599,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Kit Maceta + Sustrato Universal",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Macetas y sustratos")!.id,
          ],
          description:
            "Kit para trasplante con maceta de ceramica y sustrato universal aireado para plantas de interior.",
          handle: "kit-maceta-sustrato",
          weight: 1800,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1463320898484-cdee8141c787?auto=format&fit=crop&w=1200&q=80",
            },
          ],
          options: [
            {
              title: "Formato",
              values: ["Kit estandar"],
            },
          ],
          variants: [
            {
              title: "Kit estandar",
              sku: "KIT-MACETA-SUSTRATO",
              options: {
                Formato: "Kit estandar",
              },
              prices: [
                {
                  amount: 2599,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  })
  logger.info("Finished seeding product data.")

  logger.info("Seeding inventory levels.")

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  })

  const inventoryLevels: CreateInventoryLevelInput[] = []
  for (const inventoryItem of inventoryItems) {
    inventoryLevels.push({
      location_id: stockLocation.id,
      stocked_quantity: 250,
      inventory_item_id: inventoryItem.id,
    })
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  })

  logger.info("Finished seeding inventory levels data.")
}
