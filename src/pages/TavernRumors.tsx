import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { useDocumentTitle } from "../lib/useDocumentTitle";

interface Rumor {
  filename: string;
  date: string;
  content: string;
}

const MAX_PREVIEW_LENGTH = 150;

function RumorCard({ rumor, index }: { rumor: Rumor; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = rumor.content.length > MAX_PREVIEW_LENGTH;
  
  const displayContent = isExpanded 
    ? rumor.content 
    : isLong 
      ? `${rumor.content.slice(0, MAX_PREVIEW_LENGTH)}...` 
      : rumor.content;

  const dateObj = new Date(rumor.date);
  const dateStr = format(dateObj, 'yyyy-MM-dd');
  const timeStr = format(dateObj, 'HH:mm');

  return (
    <div className="relative hover:opacity-100 transition-opacity">
      <div className={`absolute -left-[32px] top-1 w-4 h-4 bg-parchment-200 border-2 border-guild-primary rounded-full`} />
      
      <div className="flex items-center space-x-2 text-[10px] text-guild-secondary font-mono mb-1 uppercase tracking-wider">
        <Clock size={12} />
        <span>{dateStr} • {timeStr}</span>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div 
          className={`text-sm leading-relaxed font-serif text-guild-ink prose prose-stone prose-sm ${isLong ? 'cursor-pointer hover:text-guild-ink/80 transition-colors' : ''}`}
          onClick={() => isLong && setIsExpanded(!isExpanded)}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {displayContent}
          </ReactMarkdown>
        </div>
      </motion.div>
    </div>
  );
}

export default function TavernRumors() {
  const [rumorsData, setRumorsData] = useState<Rumor[]>([]);
  const [loading, setLoading] = useState(true);

  useDocumentTitle("Tavern Rumors");

  useEffect(() => {
    fetch("/api/thoughts")
      .then(r => r.json())
      .then(data => {
        setRumorsData(data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  if (loading) {
     return (
      <div className="flex justify-center py-20">
        <div className="w-12 h-12 border-4 border-guild-primary/30 border-t-guild-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-guild-ink tracking-wide">
          Tavern Rumors
        </h1>
        <p className="text-guild-primary/80 italic font-serif max-w-xl mx-auto">
          "A hero isn't someone who never falls. It's someone who gets back up, over and over again." 
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="relative border-l border-parchment-400 ml-4 pl-8 space-y-10">
          {rumorsData.map((rumor, index) => (
            <RumorCard 
              key={rumor.filename} 
              rumor={rumor} 
              index={index}
            />
          ))}
          
          {rumorsData.length === 0 && (
            <div className="text-sm font-serif italic text-guild-secondary">No rumors found in the tavern yet.</div>
          )}
        </div>
      </div>
      
      <div className="text-center pb-8 text-[10px] tracking-widest uppercase text-guild-secondary flex items-center justify-center gap-2">
         <span className="w-1 h-1 rounded-full bg-parchment-400" />
         The tavern grows quiet
         <span className="w-1 h-1 rounded-full bg-parchment-400" />
      </div>
    </div>
  );
}
