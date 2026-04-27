import { motion } from "motion/react";
import { Github, Tv, Mail, Code, MapPin, Award, BookOpen, Sword, Coffee, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Status() {
  return (
    <div className="w-full space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Profile Card */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-parchment-100 border-2 border-parchment-400 rounded-lg p-5 shadow-inner relative"
          >
            <div className="absolute -top-3 -left-3 w-8 h-8 bg-parchment-400 rotate-45 flex items-center justify-center text-white font-bold text-lg pointer-events-none z-10 shadow-sm">
              <span className="-rotate-45">Lv.4</span>
            </div>
            
            <div className="flex flex-col items-center space-y-4 mt-2">
              <div className="w-32 h-32 rounded-full border-4 border-guild-gold shadow-md overflow-hidden bg-parchment-300 flex items-center justify-center relative">
                <img src="/avatar.jpg" alt="NanoShiki" className="w-full h-full object-cover absolute z-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
          </motion.div>

          <div className="bg-guild-ink text-parchment-200 p-4 rounded-lg flex flex-col gap-2 shadow-lg">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-parchment-400 mb-1">Familia Links</h2>
            <div className="flex items-center gap-3 py-1 hover:bg-[#745142] px-2 rounded cursor-pointer transition-colors group">
              <div className="w-2 h-2 bg-red-400 rounded-full group-hover:scale-125 transition-transform"></div>
              <span className="text-sm flex items-center gap-2"><Tv size={14} /> Bilibili / ForgeChannel</span>
            </div>
            <div className="flex items-center gap-3 py-1 hover:bg-[#745142] px-2 rounded cursor-pointer transition-colors group">
              <div className="w-2 h-2 bg-blue-400 rounded-full group-hover:scale-125 transition-transform"></div>
              <span className="text-sm flex items-center gap-2"><Github size={14} /> Guild Hub / GitHub</span>
            </div>
            <div className="flex items-center gap-3 py-1 hover:bg-[#745142] px-2 rounded cursor-pointer transition-colors group">
              <div className="w-2 h-2 bg-green-400 rounded-full group-hover:scale-125 transition-transform"></div>
              <span className="text-sm flex items-center gap-2"><Mail size={14} /> Messenger Owl</span>
            </div>
          </div>
        </aside>

        {/* Right Column: Previews */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 bg-parchment-100 border-2 border-parchment-400 p-6 rounded-lg flex flex-col overflow-hidden relative shadow-inner"
          >
            {/* Background flourish */}
            <div className="absolute bottom-[-10%] right-[-5%] opacity-5 pointer-events-none text-guild-gold">
              <Award size={250} />
            </div>

            <h2 className="text-xl font-bold border-b border-parchment-300 mb-6 pb-2 text-guild-gold font-serif uppercase tracking-widest relative z-10">
              ORARIO
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              {/* Magic Notes Preview */}
              <div className="bg-white/40 border border-parchment-300 p-4 rounded flex flex-col hover:border-guild-primary transition-colors">
                <h3 className="text-sm font-bold text-guild-primary uppercase mb-3 flex items-center gap-2">
                  <BookOpen size={14} /> Magic Notes Preview
                </h3>
                <ul className="space-y-3 flex-1 mb-4">
                  <li className="text-xs text-guild-ink/80 hover:text-guild-primary transition-colors leading-tight line-clamp-2">
                    <span className="text-guild-secondary mr-2 font-mono">04-25</span>
                    Exploring the Depths: Optimizing React Render Cycles
                  </li>
                  <li className="text-xs text-guild-ink/80 hover:text-guild-primary transition-colors leading-tight line-clamp-2">
                    <span className="text-guild-secondary mr-2 font-mono">04-12</span>
                    The Architecture of a Scalable Backend Relic
                  </li>
                </ul>
                <Link to="/magic-notes" className="text-[10px] font-bold uppercase tracking-wider text-guild-secondary hover:text-guild-primary flex items-center justify-end mt-auto">
                  Read Notes <ArrowRight size={12} className="ml-1" />
                </Link>
              </div>

              {/* Magic Records Preview */}
              <div className="bg-white/40 border border-parchment-300 p-4 rounded flex flex-col hover:border-guild-primary transition-colors">
                <h3 className="text-sm font-bold text-guild-primary uppercase mb-3 flex items-center gap-2">
                  <Sword size={14} /> Magic Records Preview
                </h3>
                <ul className="space-y-3 flex-1 mb-4">
                  <li className="text-xs text-guild-ink/80 hover:text-guild-primary transition-colors leading-tight line-clamp-2">
                    <span className="w-1.5 h-1.5 bg-guild-primary inline-block rounded-full mr-2"></span>
                    Hestia Dashboard
                  </li>
                  <li className="text-xs text-guild-ink/80 hover:text-guild-primary transition-colors leading-tight line-clamp-2">
                    <span className="w-1.5 h-1.5 bg-guild-primary inline-block rounded-full mr-2"></span>
                    Aegis Auth Provider
                  </li>
                </ul>
                <Link to="/magic-records" className="text-[10px] font-bold uppercase tracking-wider text-guild-secondary hover:text-guild-primary flex items-center justify-end mt-auto">
                  View Arsenal <ArrowRight size={12} className="ml-1" />
                </Link>
              </div>

              {/* Tavern Rumors Preview */}
              <div className="md:col-span-2 bg-white/40 border border-parchment-300 p-4 rounded flex flex-col hover:border-guild-primary transition-colors">
                <h3 className="text-sm font-bold text-guild-primary uppercase mb-3 flex items-center gap-2">
                  <Coffee size={14} /> Latest Tavern Rumor
                </h3>
                <p className="text-xs text-guild-ink/80 italic font-serif leading-relaxed pl-3 border-l-2 border-parchment-400 mb-4">
                  "The deeper you go into a legacy codebase, the more you realize that the original architects weren't constructing a tower to reach the heavens, but a labyrinth to trap the minotaur."
                </p>
                <Link to="/tavern-rumors" className="text-[10px] font-bold uppercase tracking-wider text-guild-secondary hover:text-guild-primary flex items-center justify-end">
                  More Whispers <ArrowRight size={12} className="ml-1" />
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
