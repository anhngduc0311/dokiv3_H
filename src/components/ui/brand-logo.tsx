import Image from 'next/image';

export function BrandLogo() {
  return (
    <>
      <Image
        className="brand-symbol"
        src="/brand-mark.png"
        alt=""
        aria-hidden="true"
        width={44}
        height={44}
        sizes="44px"
      />
      <Image
        className="brand-artwork"
        src="/dokihentai-wordmark-transparent.png"
        alt="DokiHentai"
        width={2149}
        height={732}
        sizes="(max-width: 480px) 126px, (max-width: 768px) 146px, 160px"
      />
    </>
  );
}
