import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Github,
  Tv,
  Mail,
  Code,
  MapPin,
  Award,
  BookOpen,
  Sword,
  Coffee,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";

interface BlogPost {
  id: string;
  title: string;
  createdTs: number;
}

interface Rumor {
  filename: string;
  date: string;
  content: string;
}

export default function Status() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [rumors, setRumors] = useState<Rumor[]>([]);

  useEffect(() => {
    fetch("/api/blog/config")
      .then(res => res.json())
      .then(data => {
        if (data?.posts) {
          setPosts([...data.posts].sort((a, b) => b.createdTs - a.createdTs).slice(0, 8));
        }
      })
      .catch(console.error);

    fetch("/api/thoughts")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRumors(data.slice(0, 2));
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6">
        {/* Left Column: Profile Card */}
        <aside className="lg:col-span-4 flex flex-col gap-8 pt-1">
          <div
            className="relative flex flex-col items-center"
          >
            <div className="flex flex-col items-center space-y-4 mt-2">
              <div className="w-32 h-32 rounded-full border-4 border-guild-gold shadow-md overflow-hidden bg-parchment-300 flex items-center justify-center relative">
                <img
                  src="/avatar.jpg"
                  alt="NanoShiki"
                  className="w-full h-full object-cover absolute z-10"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                {/* Fallback avatar image */}
                <span className="text-4xl">ð§ââï¸</span>
              </div>
              <div className="text-center mt-3">
                <h2 className="text-xl font-bold text-guild-ink font-serif tracking-wider mb-1">
                  NanoShiki
                </h2>
                <h3 className="text-xs font-bold border-t border-parchment-300 pt-1 text-guild-gold uppercase font-serif tracking-widest">
                  Magic Caster
                </h3>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-guild-secondary border-b border-parchment-300 pb-1 mb-2">
              Familia Links
            </h2>
            <a
              href="https://space.bilibili.com/253377872"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-1 hover:bg-parchment-200/50 px-2 -mx-2 rounded cursor-pointer transition-colors group text-guild-ink"
            >
              <div className="w-2 h-2 bg-pink-400 rounded-full group-hover:scale-125 transition-transform"></div>
              <span className="text-sm flex items-center gap-2 font-medium">
                <Tv size={14} /> Bilibili
              </span>
            </a>
            <a
              href="https://github.com/NanoShiki"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-1 hover:bg-parchment-200/50 px-2 -mx-2 rounded cursor-pointer transition-colors group text-guild-ink"
            >
              <div className="w-2 h-2 bg-blue-400 rounded-full group-hover:scale-125 transition-transform"></div>
              <span className="text-sm flex items-center gap-2 font-medium">
                <Github size={14} /> GitHub
              </span>
            </a>
            <a
              href="https://www.zhihu.com/people/nanoshiki"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-1 hover:bg-parchment-200/50 px-2 -mx-2 rounded cursor-pointer transition-colors group text-guild-ink"
            >
              <div className="w-2 h-2 bg-sky-400 rounded-full group-hover:scale-125 transition-transform"></div>
              <span className="text-sm flex items-center gap-2 font-medium">
                <BookOpen size={14} /> Zhihu
              </span>
            </a>
          </div>
        </aside>

        {/* Right Column: Previews */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 min-h-full flex flex-col relative"
          >
            {/* Background flourish */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none text-guild-gold z-0">
              <Award size={300} />
            </div>

            <h2 className="text-xl font-bold border-b-2 border-parchment-400 mb-6 pb-2 text-guild-gold font-serif uppercase tracking-widest relative z-10">
              ORARIO
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 flex-1">
              {/* Magic Notes Preview */}
              <div className="flex h-full flex-col group">
                <Link to="/magic-notes" className="text-sm font-bold text-guild-primary uppercase mb-4 flex items-center gap-2 hover:text-guild-ink transition-colors">
                  <BookOpen size={16} /> Magic Notes Preview
                </Link>
                <div className="flex-1 flex flex-col gap-3">
                  {posts.length > 0 ? (
                    posts.map(post => (
                      <Link to={`/magic-notes/post/${encodeURIComponent(post.id)}`} key={post.id} className="block group/item">
                        <h4 className="text-[13px] font-bold text-guild-ink group-hover/item:text-guild-primary transition-colors leading-snug line-clamp-2">
                          {post.title}
                        </h4>
                      </Link>
                    ))
                  ) : (
                    <div className="text-xs text-guild-secondary italic">Loading notes...</div>
                  )}
                </div>
                <Link
                  to="/magic-notes"
                  className="text-[10px] font-bold uppercase tracking-wider text-guild-secondary hover:text-guild-primary flex items-center justify-end mt-6 pt-4 border-t border-parchment-300"
                >
                  All Notes <ArrowRight size={12} className="ml-1" />
                </Link>
              </div>

              {/* Tavern Rumors Preview */}
              <div className="flex h-full flex-col group">
                <Link to="/tavern-rumors" className="text-sm font-bold text-guild-primary uppercase mb-4 flex items-center gap-2 hover:text-guild-ink transition-colors">
                  <Coffee size={16} /> Latest Tavern Rumors
                </Link>
                <div className="flex-1 flex flex-col gap-4 relative">
                  {/* Decorative timeline line */}
                  <div className="absolute left-[3px] top-2 bottom-0 w-px bg-parchment-300"></div>
                  
                  {rumors.length > 0 ? (
                    rumors.map(rumor => {
                      const dateObj = new Date(rumor.date);
                      const displayDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      // Remove markdown images entirely, then strip symbols
                      const cleanContent = rumor.content
                        .replace(/!\[.*?\]\(.*?\)/g, '')
                        .replace(/[#*`_\]\[()]/g, '')
                        .trim()
                        .slice(0, 180);
                      
                      return (
                        <div key={rumor.filename} className="relative pl-5 pb-2">
                          <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-parchment-200 border-2 border-guild-primary z-10"></div>
                          <div className="text-[10px] text-guild-secondary font-mono mb-1">{displayDate}</div>
                          <p className="text-xs text-guild-ink/80 italic font-serif leading-relaxed line-clamp-5">
                            "{cleanContent}{rumor.content.length > 180 ? '...' : ''}"
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="pl-5 text-xs text-guild-secondary italic">Listening to whispers...</div>
                  )}
                </div>
                <Link
                  to="/tavern-rumors"
                  className="text-[10px] font-bold uppercase tracking-wider text-guild-secondary hover:text-guild-primary flex items-center justify-end mt-6 pt-4 border-t border-parchment-300"
                >
                  More Whispers <ArrowRight size={12} className="ml-1" />
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      </div>

      <div className="mt-8 relative">
        <h2 className="text-xl font-bold border-b-2 border-parchment-400 mb-6 pb-2 text-guild-gold font-serif uppercase tracking-widest relative z-10">
          My Favorite Characters
        </h2>

        <div className="relative z-10 pt-2">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Column: Avatar & Basic Specs */}
            <div className="flex-shrink-0 w-full lg:w-64 flex flex-col items-center">
              <div className="w-32 h-32 rounded bg-[#9bcfa3]/20 border-2 border-[#9bcfa3] overflow-hidden flex items-center justify-center shadow-md relative">
                <img
                  src="/ryuu_lion.png"
                  alt="Ryuu Lion"
                  className="absolute inset-0 w-full h-full object-cover z-10"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="text-5xl">🧝‍♀️</span>
              </div>
              <h3 className="text-lg font-bold font-serif text-guild-ink mt-3">
                Ryuu Lion
              </h3>
              <div className="text-xs font-bold text-white uppercase tracking-widest bg-guild-primary px-3 py-1 rounded mt-1 shadow-sm">
                Level 6
              </div>
              <div className="text-xs text-guild-secondary italic mt-1 font-serif">
                "Gale" (疾風)
              </div>

              <div className="w-full mt-6 space-y-4">
                <div>
                  <h4 className="text-[10px] h-6 flex items-center justify-center font-bold uppercase tracking-widest text-white bg-guild-secondary rounded mb-2">
                    Characteristics
                  </h4>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">
                        Race
                      </span>
                      <span className="text-guild-ink/80 flex-1 text-right">
                        Elf
                      </span>
                    </div>
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">
                        Gender
                      </span>
                      <span className="text-guild-ink/80 flex-1 text-right">
                        Female
                      </span>
                    </div>
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">Age</span>
                      <span className="text-guild-ink/80 flex-1 text-right">
                        21
                      </span>
                    </div>
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">
                        Hair Color
                      </span>
                      <span className="text-guild-ink/80 flex-1 text-right">
                        Golden-Blonde
                      </span>
                    </div>
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">
                        Eye Color
                      </span>
                      <span className="text-guild-ink/80 flex-1 text-right">
                        Sky Blue
                      </span>
                    </div>
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">
                        Height
                      </span>
                      <span className="text-guild-ink/80 flex-1 text-right">
                        165 cm
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] h-6 flex items-center justify-center font-bold uppercase tracking-widest text-white bg-guild-secondary rounded mb-2">
                    Professional Status
                  </h4>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">
                        Affiliation
                      </span>
                      <span className="text-guild-ink/80 flex-1 text-right text-guild-gold font-bold">
                        Hestia Familia
                        <br />
                        <span className="font-normal text-guild-ink/80">
                          Hostess of Fertility
                        </span>
                      </span>
                    </div>
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">
                        Previous
                      </span>
                      <span className="text-guild-ink/80 flex-1 text-right text-guild-gold font-bold">
                        Astraea Familia
                      </span>
                    </div>
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">
                        Occupation
                      </span>
                      <span className="text-guild-ink/80 flex-1 text-right">
                        Adventurer
                        <br />
                        Waitress
                      </span>
                    </div>
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">
                        Level
                      </span>
                      <span className="text-guild-ink/80 flex-1 text-right">
                        6
                      </span>
                    </div>
                    <div className="flex border-b border-parchment-200 pb-1">
                      <span className="font-bold text-guild-ink w-20">
                        Achieved Floor
                      </span>
                      <span className="text-guild-ink/80 flex-1 text-right">
                        60
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Column: Status Bars */}
            <div className="flex-1 flex flex-col gap-6">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-white bg-guild-primary h-6 flex items-center justify-center rounded mb-4">
                  Status
                </h4>
                <div className="space-y-4">
                  {[
                    { label: "Strength", rank: "I", value: 45 },
                    { label: "Endurance", rank: "I", value: 25 },
                    { label: "Dexterity", rank: "I", value: 97 },
                    { label: "Agility", rank: "H", value: 100 },
                    { label: "Magic", rank: "I", value: 71 },
                  ].map((stat, i) => (
                    <div key={i} className="flex items-center text-xs">
                      <span className="w-20 font-bold text-guild-ink">
                        {stat.label}
                      </span>
                      <span className="w-10 font-mono font-bold text-guild-primary text-right mr-3">
                        {stat.rank}
                        {stat.value}
                      </span>
                      <div className="flex-1 h-2 bg-parchment-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-guild-primary/70 rounded-full"
                          style={{
                            width: `${Math.max((stat.value / 999) * 100, 2)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t border-parchment-300 pt-3 mt-4 space-y-2">
                    {[
                      { label: "Hunter", rank: "G" },
                      { label: "Mage", rank: "I" },
                      { label: "Abnormal Resistance", rank: "G" },
                      { label: "Magic Resistance", rank: "I" },
                      { label: "Chain Attack", rank: "I" },
                    ].map((stat, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs py-1 border-b border-parchment-200 last:border-0 hover:bg-parchment-200/50 px-1 -mx-1 rounded transition-colors"
                      >
                        <span className="font-bold text-guild-ink">
                          {stat.label}
                        </span>
                        <span className="font-mono font-bold text-guild-gold/80 px-2 py-0.5 bg-guild-gold/10 rounded">
                          {stat.rank}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Skills & Magic */}
            <div className="flex-1 flex flex-col gap-6">
              <div>
                <div className="space-y-4">
                  <div>
                    <h5 className="text-[10px] font-bold text-guild-primary uppercase border-b border-parchment-300 pb-1 mb-2">
                      Skill
                    </h5>
                    <ul className="text-xs text-guild-ink/80 text-right space-y-1 font-medium">
                      <li>Fairy Serenade</li>
                      <li>Mind Load</li>
                      <li>Aero Mana</li>
                      <li>Astrae Varmas</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="text-[10px] font-bold text-guild-primary uppercase border-b border-parchment-300 pb-1 mb-2">
                      Magic
                    </h5>
                    <ul className="text-xs text-guild-gold text-right space-y-1 font-bold">
                      <li>Luminous Wind</li>
                      <li>Noah Heal</li>
                      <li>Astraea Record</li>
                    </ul>
                  </div>

                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="text-[10px] font-bold text-guild-primary uppercase">
                        Weapon
                      </h5>
                      <div className="text-xs text-guild-ink/80 text-right space-y-1 font-medium">
                        <div>Alf's Justitia</div>
                        <div>Kodachi Futaba</div>
                      </div>
                    </div>
                    <div className="flex items-start justify-between border-t border-parchment-200 pt-2 mt-2">
                      <h5 className="text-[10px] font-bold text-guild-primary uppercase">
                        Equipment
                      </h5>
                      <div className="text-xs text-guild-ink/80 text-right space-y-1 font-medium">
                        Spirit's Clothes of Justice
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
