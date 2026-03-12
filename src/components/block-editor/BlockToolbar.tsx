import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "../ui/button";

interface BlockToolbarProps {
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function BlockToolbar({
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
}: BlockToolbarProps) {
  return (
    <div className="flex items-center justify-between mt-1.5">
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="上に移動"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="下に移動"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4 mr-1" />
        削除
      </Button>
    </div>
  );
}
