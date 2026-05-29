import type { CategoryStat } from "../types";

export function CategoryBar({
  categories,
  activeCategory,
  selectable = false,
  onSelectCategory,
}: {
  categories: CategoryStat[];
  activeCategory?: string;
  selectable?: boolean;
  onSelectCategory?: (categoryName: string) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div
      className={["category-bar", selectable && "category-bar--selectable"]
        .filter(Boolean)
        .join(" ")}
      role={selectable ? "group" : "list"}
      aria-label="Question categories"
    >
      {categories.map((cat) => {
        const isActive =
          !selectable &&
          activeCategory !== undefined &&
          cat.name === (activeCategory.trim() || "General");
        const isEmpty = cat.remaining === 0;
        const canSelect = selectable && !isEmpty && onSelectCategory;

        if (canSelect) {
          return (
            <button
              key={cat.name}
              type="button"
              className="category-chip category-chip--button"
              onClick={() => onSelectCategory(cat.name)}
            >
              <span className="category-chip__name">{cat.name}</span>
              <span className="category-chip__count">
                {cat.remaining} left
              </span>
            </button>
          );
        }

        return (
          <div
            key={cat.name}
            role="listitem"
            className={[
              "category-chip",
              isActive && "category-chip--active",
              isEmpty && "category-chip--empty",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="category-chip__name">{cat.name}</span>
            <span className="category-chip__count">
              {cat.remaining} left
            </span>
          </div>
        );
      })}
    </div>
  );
}
