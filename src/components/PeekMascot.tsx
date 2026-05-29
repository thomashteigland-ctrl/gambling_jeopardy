import { useEffect, useState } from "react";

type MascotVariant = "thomas" | "johannes";

const STORAGE_KEY = "gambling-charades-mascot";

const MASCOT_SRC: Record<MascotVariant, string> = {
  thomas: "/mascot_thomas.png",
  johannes: "/mascot_johannes.png",
};

function loadMascotVariant(): MascotVariant {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "thomas" || stored === "johannes") return stored;
  } catch {
    /* ignore */
  }
  return "thomas";
}

export function PeekMascot() {
  const [variant, setVariant] = useState<MascotVariant>(loadMascotVariant);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, variant);
    } catch {
      /* ignore */
    }
  }, [variant]);

  return (
    <aside className="peek-mascot">
      <div
        className="mascot-toggle"
        role="group"
        aria-label="Mascot version"
      >
        <button
          type="button"
          className={`mascot-toggle__option mascot-toggle__option--thomas${variant === "thomas" ? " mascot-toggle__option--active" : ""}`}
          aria-label="Thomas"
          aria-pressed={variant === "thomas"}
          onClick={() => setVariant("thomas")}
        />
        <button
          type="button"
          className={`mascot-toggle__option mascot-toggle__option--johannes${variant === "johannes" ? " mascot-toggle__option--active" : ""}`}
          aria-label="Johannes"
          aria-pressed={variant === "johannes"}
          onClick={() => setVariant("johannes")}
        />
      </div>
      <img
        className="peek-mascot__img"
        src={MASCOT_SRC[variant]}
        alt=""
        decoding="async"
        key={variant}
      />
    </aside>
  );
}
