import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsFromName } from "@/lib/item-type-ui";
import { cn } from "@/lib/utils";

/** The GitHub image when the user has one, otherwise their initials ("Brad Traversy" → "BT"). */
export function UserAvatar({
  name,
  email,
  image,
  className,
}: Readonly<{
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  className?: string;
}>) {
  return (
    <Avatar className={cn("size-7 rounded-lg", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback className="rounded-lg text-xs">
        {initialsFromName(name ?? email ?? null)}
      </AvatarFallback>
    </Avatar>
  );
}
