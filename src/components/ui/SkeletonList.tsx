import SkeletonCard from "./SkeletonCard";

interface Props {
  count?: number;
  showAvatar?: boolean;
}

export default function SkeletonList({ count = 3, showAvatar = false }: Props) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} showAvatar={showAvatar} />
      ))}
    </div>
  );
}
