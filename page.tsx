import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { guideAmazonUrl, SEO_GUIDES } from "@/app/lib/seo-guides";
import TrackedAmazonLink from "@/app/components/tracked-amazon-link";

export const dynamicParams = false;

export function generateStaticParams() {
  return SEO_GUIDES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = SEO_GUIDES.find((item) => item.slug === slug);
  if (!guide) return {};
  return {
    title: `${guide.title} | Passerelle`,
    description: guide.summary,
    alternates: { canonical: `/productos/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.summary, type: "article", locale: "es_ES" },
  };
}

const disclosure = "Passerelle participa en el Programa de Afiliados de Amazon. Si compras desde nuestros enlaces, podemos recibir una comisión sin coste adicional para ti. El precio y la disponibilidad pueden cambiar; consulta siempre Amazon antes de comprar.";

export default async function ProductGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = SEO_GUIDES.find((item) => item.slug === slug);
  if (!guide) notFound();
  const productUrl = guideAmazonUrl(guide);
  const faq = [
    { q: `¿Para quién puede encajar ${guide.title.split(":")[0]}?`, a: `Puede ser una opción para quien busca ${guide.category.toLowerCase()} y ha comprobado que las dimensiones, el mantenimiento y las funciones del modelo disponible se ajustan a su hogar. La decisión depende del uso real, no solo del nombre de la gama.` },
    { q: "¿El precio de esta guía es el precio actual?", a: "No publicamos un precio fijo porque los importes, promociones, vendedores y disponibilidad de Amazon cambian. El enlace abre la búsqueda o la ficha para que consultes las condiciones vigentes antes de comprar." },
    { q: "¿Cómo verifico qué incluye la oferta?", a: "Abre la ficha de Amazon y comprueba el nombre exacto del modelo, número de modelo, accesorios, vendedor, garantía, devolución y entrega. Las variantes pueden compartir imágenes y diferir en contenido." },
    { q: "¿La recomendación sustituye a comparar otros modelos?", a: "No. Usa esta guía como lista de comprobación y compara al menos dos alternativas de la misma categoría, teniendo en cuenta el coste inicial y el mantenimiento." },
  ];
  const schema = {
    "@context": "https://schema.org", "@type": "Product", name: guide.title, brand: { "@type": "Brand", name: guide.brand }, category: guide.category,
    description: guide.summary, url: `https://omni-final-one.vercel.app/productos/${guide.slug}`,
  };
  const paragraphs = [
    `La mejor elección empieza por una pregunta sencilla: qué tarea quieres resolver y con qué frecuencia. En la categoría ${guide.category.toLowerCase()}, dos productos con aspecto parecido pueden diferir en tamaño, consumibles, controles, servicio y comodidad. Antes de fijarte en una promoción, anota las condiciones de tu casa y el uso habitual. Esta guía ordena esa evaluación para ${guide.title.split(":")[0]}.`,
    `La descripción de una ficha comercial no siempre permite saber si un aparato será cómodo en tu rutina. Conviene relacionar cada función con una tarea concreta: qué prepararás o limpiarás, cuántas personas lo usarán, dónde lo guardarás y cuánto tiempo quieres dedicar a mantenerlo. Si una prestación no resuelve una necesidad real, quizá no merezca pagar más por ella.`,
    `Las especificaciones sirven para descartar opciones incompatibles, pero no describen por completo la experiencia cotidiana. Compara medidas, capacidad útil, controles, accesorios y mantenimiento del modelo exacto. Cuando una tienda reúne varias versiones bajo una misma familia, revisa el número de modelo y no te guíes únicamente por el título o la fotografía.`,
    `También importa el coste total. Además del precio de compra, considera filtros, bolsas, detergentes compatibles, accesorios, energía, limpieza y posibles recambios. No todos esos costes aplican a todos los aparatos; consulta el manual y la ficha del modelo que estés evaluando. Una opción económica puede resultar menos conveniente si depende de consumibles difíciles de encontrar.`,
    `Piensa en el espacio disponible antes de pedirlo. Mide la zona de uso y de almacenamiento, deja margen para ventilación y acceso, y comprueba cómo se guardan cables y accesorios. Si el dispositivo se desplaza o se limpia con frecuencia, el peso y el desmontaje pueden influir más que una función llamativa.`,
    `La durabilidad depende del uso, el cuidado, las piezas disponibles y las condiciones de garantía. Busca instrucciones de mantenimiento comprensibles, confirma cómo se limpian las partes en contacto con alimentos o polvo y comprueba si se venden consumibles originales o compatibles. Revisa además las políticas actuales de devolución y quién vende y envía el artículo.`,
    `La experiencia de otras personas puede aportar pistas sobre problemas prácticos, aunque las valoraciones cambian y no garantizan el resultado en tu hogar. Lee opiniones recientes de la misma variante y busca comentarios concretos sobre los aspectos que te importan. Distingue una experiencia individual de una característica confirmada por el fabricante.`,
    `En resumen, ${guide.title.split(":")[0]} merece consideración si sus funciones confirmadas encajan con una necesidad concreta, si cabe en tu espacio y si el mantenimiento es asumible. Si esos puntos no están claros, compara alternativas antes de decidir. Este contenido es una guía de compra general; no es una prueba de laboratorio ni una afirmación de experiencia personal con el producto.`,
  ];
  return <main className="guide-shell">
    <Link className="guide-back" href="/">← PASSERELLE · Selección de hogar</Link>
    <article>
      <p className="guide-eyebrow">GUÍA DE COMPRA · {guide.category.toUpperCase()}</p>
      <h1>{guide.title}</h1>
      <p className="guide-lead">{guide.summary}</p>
      <p className="guide-disclosure">{disclosure}</p>
      <TrackedAmazonLink className="guide-cta" href={productUrl} productId={guide.slug}>Ver disponibilidad en Amazon →</TrackedAmazonLink>
      <h2>Resumen: qué conviene saber</h2>
      <p>{guide.summary} No asumimos un precio, stock o puntuación fija: esos datos cambian y deben consultarse en la ficha enlazada. Los detalles técnicos descritos en esta página son criterios de comparación; confirma cada prestación en el modelo exacto.</p>
      <h2>¿Para quién puede ser una buena opción?</h2>
      <ul>{guide.fit.map((point) => <li key={point}>{point}</li>)}</ul>
      <h2>Aspectos que conviene comprobar antes de comprar</h2>
      <ul>{guide.considerations.map((point) => <li key={point}>{point}</li>)}</ul>
      <h2>Cómo comparar la ficha del producto</h2>
      {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      <h2>Lista práctica de comprobación</h2>
      <ol>
        <li>Define el uso más frecuente y el resultado que esperas obtener.</li>
        <li>Comprueba el nombre y número de modelo exactos, junto con sus dimensiones.</li>
        <li>Valida las funciones y accesorios en la ficha del vendedor, no solo en una imagen.</li>
        <li>Calcula consumibles, recambios y mantenimiento junto al precio inicial.</li>
        <li>Lee condiciones de entrega, devolución, garantía y vendedor antes de pagar.</li>
        <li>Compara alternativas y conserva la opción que mejor resuelva tu necesidad.</li>
      </ol>
      <h2>Preguntas frecuentes</h2>
      {faq.map(({ q, a }) => <section className="guide-faq" key={q}><h3>{q}</h3><p>{a}</p></section>)}
      <p className="guide-updated">Guía editorial de Passerelle. No contiene precios ni valoraciones inventados. Las características y condiciones comerciales deben confirmarse en Amazon.</p>
      <TrackedAmazonLink className="guide-cta" href={productUrl} productId={guide.slug}>Consultar en Amazon →</TrackedAmazonLink>
    </article>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
  </main>;
}
