import { Heading, Text } from "@medusajs/ui"

const Hero = () => {
  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative bg-ui-bg-subtle">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <span>
          <Heading
            level="h1"
            className="text-3xl leading-10 text-ui-fg-base font-normal"
          >
            Vivero Verde ERP
          </Heading>
          <Heading
            level="h2"
            className="text-3xl leading-10 text-ui-fg-subtle font-normal"
          >
            Frontend y backend de ecommerce para venta de plantas
          </Heading>
        </span>
        <Text className="txt-medium text-ui-fg-subtle">
          Catalogo inicial con plantas de interior, exterior y accesorios.
        </Text>
      </div>
    </div>
  )
}

export default Hero
