import { useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Calendar, Tag } from "lucide-react";

const blogPosts = [
  {
    id: 1,
    title: "Exploring the Depths: Optimizing React Render Cycles",
    excerpt: "Venturing into the lower levels of the DOM tree can be perilous. Here's a record of the strategies employed to reduce unnecessary renders and boost application agility.",
    date: "2026-04-25",
    tags: ["React", "Performance", "Magic"],
    rotation: "-rotate-1"
  },
  {
    id: 2,
    title: "The Architecture of a Scalable Backend Relic",
    excerpt: "A detailed account of constructing a RESTful API capable of withstanding the simultaneous requests of thousands of adventurers without buckling under the load.",
    date: "2026-04-12",
    tags: ["Node.js", "Architecture", "Relics"],
    rotation: "rotate-1"
  },
  {
    id: 3,
    title: "Taming the CSS Labyrinth: A Guide to Tailwind CSS",
    excerpt: "Many have been lost in the endless corridors of global stylesheets. Tailwind provides a map. A practical grimoire for utility-first styling.",
    date: "2026-03-28",
    tags: ["CSS", "Tailwind", "Styling"],
    rotation: "-rotate-2"
  },
  {
    id: 4,
    title: "Quest Log: My First Encounter with Web3 Spatial Web",
    excerpt: "Notes on stepping beyond the traditional 2D web interfaces and into immersive spatial domains. The beasts here are new, but the thrill of discovery is unmatched.",
    date: "2026-03-15",
    tags: ["Web3", "Spatial", "Expedition"],
    rotation: "rotate-2"
  }
];

export default function MagicNotes() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(2);
  
  const allTags = Array.from(new Set(blogPosts.flatMap(post => post.tags)));
  const filteredPosts = selectedTag ? blogPosts.filter(p => p.tags.includes(selectedTag)) : blogPosts;
  const visiblePosts = filteredPosts.slice(0, visibleCount);

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "200px 0px", // Load slightly ahead of scrolling
  });

  useEffect(() => {
    if (inView && visibleCount < filteredPosts.length) {
      setVisibleCount((v) => v + 2);
    }
  }, [inView, visibleCount, filteredPosts.length]);

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-guild-ink tracking-wide">
          Magic Notes
        </h1>
        <p className="text-guild-primary/80 italic font-serif max-w-xl mx-auto">
          "An adventure... is stepping into the unknown, experiencing the unexpected. That is the true thrill of discovery."
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mt-6 mb-4">
        <button 
          onClick={() => { setSelectedTag(null); setVisibleCount(2); }}
          className={`px-3 py-1 rounded-sm text-xs font-bold font-sans uppercase tracking-wider transition-colors border-2 ${selectedTag === null ? 'bg-guild-primary text-white border-guild-primary shadow-sm' : 'bg-parchment-200 text-guild-secondary border-parchment-300 hover:border-guild-primary'}`}
        >
          All
        </button>
        {allTags.map(tag => (
          <button 
            key={tag}
            onClick={() => { setSelectedTag(tag); setVisibleCount(2); }}
            className={`px-3 py-1 rounded-sm text-xs font-bold font-sans uppercase tracking-wider transition-colors border-2 ${selectedTag === tag ? 'bg-guild-primary text-white border-guild-primary shadow-sm' : 'bg-parchment-200 text-guild-secondary border-parchment-300 hover:border-guild-primary'}`}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 pt-2">
          {visiblePosts.map((post, index) => (
            <Link to={`#post-${post.id}`} key={post.id} className="block group">
              <motion.article
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`
                  h-full bg-white/50 border-l-4 border-guild-primary p-5 rounded-r-lg relative transition-all duration-300
                  group-hover:bg-white/80 group-hover:shadow-sm group-hover:translate-x-1
                `}
              >
                <div className="relative z-10 cursor-pointer h-full flex flex-col">
              <div className="flex items-center space-x-2 text-xs font-bold font-sans text-guild-primary uppercase mb-2">
                <span className="w-2 h-2 bg-guild-primary rotate-45 inline-block mr-1"></span> 
                <Calendar size={12} className="inline" />
                <span>{post.date}</span>
              </div>
              
              <h2 className="text-lg font-bold text-guild-ink mb-2 leading-tight group-hover:text-guild-primary transition-colors font-sans">
                {post.title}
              </h2>
              
              <p className="text-[#8c7365] text-sm mb-4 line-clamp-2 leading-relaxed font-sans">
                {post.excerpt}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-2">
                <div className="flex flex-wrap gap-2">
                  {post.tags.map(tag => (
                    <span key={tag} className="flex items-center text-[10px] text-guild-primary bg-guild-primary/10 px-2 py-0.5 rounded font-medium uppercase tracking-wider">
                      <Tag size={10} className="mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.article>
        </Link>
        ))}
      </div>
      
      {visibleCount < filteredPosts.length && (
        <div ref={ref} className="flex justify-center pt-10 pb-4">
          <div className="w-8 h-8 border-4 border-guild-primary/30 border-t-guild-primary rounded-full animate-spin"></div>
        </div>
      )}
     </div>
    </div>
  );
}
