import logoAsset from "@/assets/weyze-logo.png.asset.json";

export function WeyzeLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Weyze"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: "50%" }}
    />
  );
}