import { useState } from "react";
import { motion } from "motion/react";
import { Clock } from "lucide-react";

interface Rumor {
  id: string;
  date: string;
  time: string;
  content: string;
}

const rumorsData: Rumor[] = [
  {
    id: "r1",
    date: "2026-04-26",
    time: "23:45",
    content: "The deeper you go into a legacy codebase, the more you realize that the original architects weren't constructing a tower to reach the heavens, but a labyrinth to trap the minotaur. Found a module today that recursively calls itself to simulate a while loop. Madness."
  },
  {
    id: "r2",
    date: "2026-04-24",
    time: "14:20",
    content: "Overheard at the tavern: 'If your tests are passing on the first try, you haven't written enough tests, or your tests are testing the tests.' I relate to this on a spiritual level. Also, I think I need more coffee."
  },
  {
    id: "r3",
    date: "2026-04-20",
    time: "09:15",
    content: "There's a strange beauty in seeing a perfectly executing CI/CD pipeline. It's like watching a well-coordinated party raid a boss floor. Everyone does their part, the magic flows horizontally, and boom, deployment successful."
  },
  {
    id: "r4",
    date: "2026-04-18",
    time: "18:05",
    content: "A detailed account of my encounter with the dreaded 'Hydra Bug'. Cut off one head (fix one edge case), two more take its place. To defeat it, you don't use sword strokes (quick patches), you use fire (completely rewrite the logic module from the ground up). It took three nights, but the beast is slain. Now to document the encounter so the next generation of adventurers doesn't fall to the same trap. Remember, folks, state management needs strict borders, otherwise the state mutates uncontrollably. Use immutable data structures whenever you can!"
  },
  {
    id: "r5",
    date: "2026-04-10",
    time: "11:30",
    content: "Sometimes I wonder if using so many external libraries is equivalent to equipping cursed items. Sure, they give massive stat boosts initially, but eventually, you have to pay the price in maintained dependencies and security vulnerabilities."
  }
];

const MAX_PREVIEW_LENGTH = 150;

function RumorCard({ rumor, index }: { rumor: Rumor; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = rumor.content.length > MAX_PREVIEW_LENGTH;
  
  const displayContent = isExpanded 
    ? rumor.content 
    : isLong 
      ? `${rumor.content.slice(0, MAX_PREVIEW_LENGTH)}...` 
      : rumor.content;

  return (
    <div className="relative hover:opacity-100 transition-opacity">
      <div className={`absolute -left-[32px] top-1 w-4 h-4 bg-parchment-200 border-2 border-guild-primary rounded-full`} />
      
      <div className="flex items-center space-x-2 text-[10px] text-guild-secondary font-mono mb-1 uppercase tracking-wider">
        <Clock size={12} />
        <span>{rumor.date} • {rumor.time}</span>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <p 
          className={`text-sm leading-relaxed font-serif text-guild-ink ${isLong ? 'cursor-pointer hover:text-guild-ink/80 transition-colors' : ''}`}
          onClick={() => isLong && setIsExpanded(!isExpanded)}
        >
          {displayContent}
        </p>
      </motion.div>
    </div>
  );
}

export default function TavernRumors() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex-1 bg-parchment-100 border-2 border-parchment-400 p-5 rounded-lg flex flex-col overflow-hidden">
        <h2 className="text-xs font-bold text-guild-primary uppercase mb-6 flex items-center gap-2 font-sans tracking-widest">
           <span className="w-2 h-2 bg-guild-primary rounded-full"></span> Oracle's Log (Timeline)
        </h2>

        <div className="relative flex-1 border-l border-parchment-400 ml-2 pl-6 space-y-8 overflow-hidden">
          {rumorsData.map((rumor, index) => (
            <RumorCard 
              key={rumor.id} 
              rumor={rumor} 
              index={index}
            />
          ))}
        </div>
      </div>
      
      <div className="text-center pb-4 text-[10px] tracking-widest uppercase text-guild-secondary flex items-center justify-center gap-2">
         <span className="w-1 h-1 rounded-full bg-parchment-400" />
         The tavern grows quiet
         <span className="w-1 h-1 rounded-full bg-parchment-400" />
      </div>
    </div>
  );
}
