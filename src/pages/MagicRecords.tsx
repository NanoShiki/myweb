import { useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { motion } from "motion/react";
import { BookOpenText } from "lucide-react";

const projects = [
  {
    title: "Hestia Dashboard",
    description: "A centralized command center for monitoring server statuses and resource allocations. Features real-time metrics, anomaly detection enchantments, and an intuitive grimoire-like interface.",
    tech: ["React", "TypeScript", "Tailwind", "Recharts"],
    github: "#",
    live: "#"
  },
  {
    title: "Aegis Auth Provider",
    description: "An impenetrable authentication wrapper protecting applications from unauthorized access. Implements JWT validation, rate limiting wards, and role-based access control.",
    tech: ["Node.js", "Express", "Redis", "Security"],
    github: "#",
    live: null
  },
  {
    title: "Babel Translator API",
    description: "A hyper-fast microservice bridging the linguistic gaps between different data formats. Converts ancient XML scrolls into modern JSON outputs with extreme precision.",
    tech: ["Go", "gRPC", "Docker"],
    github: "#",
    live: "#"
  },
  {
    title: "Labyrinth Mapper",
    description: "An interactive visualization tool mapping out complex database relationships and architectural dependencies within large, sprawling monolithic codebases.",
    tech: ["React Flow", "D3.js", "Vite"],
    github: "#",
    live: "#"
  }
];

export default function MagicRecords() {
  const [visibleCount, setVisibleCount] = useState(2);
  const visibleProjects = projects.slice(0, visibleCount);

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "200px 0px", // Load slightly ahead of scrolling
  });

  useEffect(() => {
    if (inView && visibleCount < projects.length) {
      setVisibleCount((v) => v + 2);
    }
  }, [inView, visibleCount]);

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-guild-ink tracking-wide">
          Magic Records
        </h1>
        <p className="text-guild-primary/80 italic font-serif max-w-xl mx-auto">
          "I won't forge something that betrays its master. Every line of code forged here carries my soul and pride."
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
        {visibleProjects.map((project, idx) => {
          return (
            <motion.a
              href={project.live || project.github}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              key={project.title}
              className="block bg-parchment-100 border-2 border-parchment-400 p-5 rounded-lg flex flex-col overflow-hidden shadow-inner relative group hover:border-guild-primary transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-3 border-b border-parchment-300 pb-3">
                <div className="w-8 h-8 flex items-center justify-center bg-parchment-300 text-guild-gold rounded-sm shadow-sm transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">
                  <BookOpenText size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-guild-gold font-sans uppercase tracking-wide group-hover:text-guild-primary transition-colors">{project.title}</h2>
                </div>
              </div>

              <p className="text-guild-muted text-sm leading-relaxed mb-6 flex-grow font-serif">
                {project.description}
              </p>

              <div className="space-y-4 mt-auto">
                <div className="flex flex-wrap gap-2">
                  {project.tech.map(t => (
                    <span key={t} className="text-[10px] uppercase font-bold tracking-wider text-guild-ink px-2 py-1 rounded bg-parchment-300">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.a>
          );
        })}
      </div>

      {visibleCount < projects.length && (
        <div ref={ref} className="flex justify-center pt-6">
          <div className="w-8 h-8 border-4 border-guild-primary/30 border-t-guild-primary rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}
