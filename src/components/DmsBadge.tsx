import { Shield, ShieldOff } from "lucide-react";
import Badge from "./ui/Badge";

/** ДМС marker for a doctor. Renders nothing when 1С gave no value. */
export default function DmsBadge({ dms }: { dms?: boolean }) {
  if (dms === true) {
    return (
      <Badge variant="success">
        <Shield className="w-3 h-3 mr-0.5" />
        ДМС
      </Badge>
    );
  }
  if (dms === false) {
    return (
      <Badge variant="neutral">
        <ShieldOff className="w-3 h-3 mr-0.5" />
        Без ДМС
      </Badge>
    );
  }
  return null;
}
