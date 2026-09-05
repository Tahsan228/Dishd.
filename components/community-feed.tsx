import { ArrowUpRight, Heart, Star } from "lucide-react";
import { kitchens, stories } from "@/lib/demo-data";

export function CommunityFeed({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <section className="community-section" id="community">
      <div className="section-heading">
        <div>
          <p className="eyebrow">The good food gets around</p>
          <h2>From one neighbor to another.</h2>
        </div>
        <span className="community-note">
          <Heart size={17} />A little food diary inspiration
        </span>
      </div>
      <div className="story-grid">
        {stories.map((story, index) => {
          const kitchen = kitchens.find((item) => item.id === story.kitchenId)!;
          return (
            <article className="story-card" key={story.id}>
              <div className="story-author">
                <span className={`avatar avatar-${index}`}>
                  {story.initials}
                </span>
                <div>
                  <strong>{story.name}</strong>
                  <span>logged a meal · {story.time}</span>
                </div>
                <span
                  className="story-stars"
                  aria-label={`${story.rating10 / 2} out of 5 stars`}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={11} fill="currentColor" />
                  ))}
                </span>
              </div>
              <h3>“{story.title}”</h3>
              <p>{story.body}</p>
              <button
                className="story-kitchen"
                onClick={() => onOpen(kitchen.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={kitchen.image}
                  alt=""
                  width={44}
                  height={44}
                  loading="lazy"
                />
                <span>
                  <small>AT THE TABLE WITH</small>
                  <strong>{kitchen.name}</strong>
                </span>
                <ArrowUpRight size={17} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
