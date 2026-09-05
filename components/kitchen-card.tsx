import { ArrowUpRight, Clock3, Heart, Star } from "lucide-react";
import type { Kitchen } from "@/lib/demo-data";
import { mealPrice, money } from "@/lib/discovery";

export function KitchenCard({
  kitchen,
  saved,
  onSave,
  onOpen,
}: {
  kitchen: Kitchen;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  return (
    <article className="kitchen-card">
      <button
        className="kitchen-card-open"
        onClick={onOpen}
        aria-label={`Explore ${kitchen.name}`}
      >
        <div className="kitchen-image">
          {/* Local editorial/demo assets; plain img keeps the first preview simple. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={kitchen.image}
            alt={kitchen.imageAlt}
            loading="lazy"
            width="720"
            height="480"
          />
          {kitchen.badge && (
            <span className="image-label">{kitchen.badge}</span>
          )}
          <span className="image-arrow">
            <ArrowUpRight size={18} />
          </span>
        </div>
        <div className="kitchen-info">
          <div className="kitchen-title-row">
            <h3>{kitchen.name}</h3>
            <span className="rating">
              <Star size={13} fill="currentColor" />
              {(kitchen.rating10 / 2).toFixed(1)}
              <span>({kitchen.reviews})</span>
            </span>
          </div>
          <p className="kitchen-byline">
            {kitchen.cuisine}
            <span>·</span>
            {kitchen.neighborhood}
            <span>·</span>
            {kitchen.distance} mi
          </p>
          <div className="kitchen-bottom">
            <span className={kitchen.today ? "pickup today" : "pickup"}>
              <Clock3 size={13} />
              {kitchen.pickup}
            </span>
            <span className="price">
              From <strong>{money(mealPrice(kitchen))}</strong>
            </span>
          </div>
        </div>
      </button>
      <button
        className={`save-button ${saved ? "is-saved" : ""}`}
        aria-label={`${saved ? "Unsave" : "Save"} ${kitchen.name}`}
        aria-pressed={saved}
        onClick={onSave}
      >
        <Heart size={18} fill={saved ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
