import { Sprite } from "@/art/pixel";
import { AVATARS, AVATAR_SPRITES, type AvatarKey } from "@/art/avatars";

export function Avatar({ avatar, scale = 2 }: { avatar: string; scale?: number }) {
  const sprite = AVATAR_SPRITES[avatar as AvatarKey];
  if (!sprite) return <span style={{ width: 20 * scale, height: 22 * scale, display: "inline-block" }} />;
  return <Sprite sprite={sprite} scale={scale} title={AVATARS[avatar as AvatarKey].name} />;
}
