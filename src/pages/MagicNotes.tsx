import { useState, useEffect } from "react";
import { Link, Route, Routes, useParams, useNavigate } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { motion } from "motion/react";
import { Tag, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import GithubSlugger from "github-slugger";
import Zoom from "react-medium-image-zoom";

import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";
import "react-medium-image-zoom/dist/styles.css";

interface BlogPost {

  id: string;
  title: string;
  date: string;
  createdTs: number;
  path: string;
  categories: string[];
}

interface BlogConfig {
  site: { title: string; subtitle: string; author: string };
  posts: BlogPost[];
}

function BlogList({ posts }: { posts: BlogPost[] }) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  
  const allTags = Array.from(new Set(posts.flatMap(post => post.categories)));
  const filteredPosts = selectedTag ? posts.filter(p => p.categories.includes(selectedTag)) : posts;
  const visiblePosts = filteredPosts.slice(0, visibleCount);

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "200px 0px",
  });

  useEffect(() => {
    if (inView && visibleCount < filteredPosts.length) {
      setVisibleCount((v) => v + 10);
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
          onClick={() => { setSelectedTag(null); setVisibleCount(10); }}
          className={`px-3 py-1 rounded-sm text-xs font-bold font-sans uppercase tracking-wider transition-colors border-2 ${selectedTag === null ? 'bg-guild-primary text-white border-guild-primary shadow-sm' : 'bg-parchment-200 text-guild-secondary border-parchment-300 hover:border-guild-primary'}`}
        >
          All
        </button>
        {allTags.map(tag => (
          <button 
            key={tag}
            onClick={() => { setSelectedTag(tag); setVisibleCount(10); }}
            className={`px-3 py-1 rounded-sm text-xs font-bold font-sans uppercase tracking-wider transition-colors border-2 ${selectedTag === tag ? 'bg-guild-primary text-white border-guild-primary shadow-sm' : 'bg-parchment-200 text-guild-secondary border-parchment-300 hover:border-guild-primary'}`}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 pt-2">
          {visiblePosts.map((post, index) => (
            <Link to={`/magic-notes/post/${encodeURIComponent(post.id)}`} key={post.id} className="block group">
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
                  <h2 className="text-lg font-bold text-guild-ink mb-2 leading-tight group-hover:text-guild-primary transition-colors font-sans">
                    {post.title}
                  </h2>
                  
                  <div className="flex items-center justify-between mt-auto pt-4">
                    <div className="flex flex-wrap gap-2">
                      {post.categories.map(tag => (
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
      </div>
      
      {visibleCount < filteredPosts.length && (
        <div ref={ref} className="flex justify-center pt-10 pb-4">
          <div className="w-8 h-8 border-4 border-guild-primary/30 border-t-guild-primary rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}

interface Heading {
  id: string;
  text: string;
  level: number;
}

function useHeadings(content: string) {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const headingElements = Array.from(
        document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6')
      ) as HTMLElement[];
      
      const extractedHeadings = headingElements.map(el => ({
        id: el.id,
        text: el.innerText || el.textContent || "",
        level: parseInt(el.tagName.replace('H', ''), 10)
      }));
      setHeadings(extractedHeadings);
    }, 150);
    return () => clearTimeout(timer);
  }, [content]);

  return headings;
}

function useScrollSpy(headings: Heading[]) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0) return;

    const handleScroll = () => {
      let currentId = headings[0]?.id || "";
      
      // We look for the last heading that has passed the threshold mark (200px from top)
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200) {
            currentId = heading.id;
          } else {
            // Once we find a heading that is below the threshold,
            // we stop, because the headings are in order.
            break;
          }
        }
      }
      
      setActiveId(currentId);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Run once on mount to set initial state
    setTimeout(handleScroll, 100);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  return activeId;
}

function TableOfContents({ headings, activeId }: { headings: Heading[], activeId: string }) {
  const activeIndex = headings.findIndex(h => h.id === activeId);
  const activePath = new Set<string>();
  
  if (activeIndex !== -1) {
     let currentLevel = headings[activeIndex].level;
     activePath.add(headings[activeIndex].id);
     for (let i = activeIndex - 1; i >= 0; i--) {
        if (headings[i].level < currentLevel) {
           activePath.add(headings[i].id);
           currentLevel = headings[i].level;
        }
     }
  }

  useEffect(() => {
    if (activeId) {
      // Small timeout to allow render to complete before scrolling
      setTimeout(() => {
        const activeLink = document.querySelector(`nav a[href="#${activeId}"]`);
        if (activeLink) {
          activeLink.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }, 50);
    }
  }, [activeId]);

  return (
    <nav className="sticky top-12 self-start w-56 shrink-0 max-h-[calc(100vh-6rem)] overflow-y-auto hidden lg:block scrollbar-thin scrollbar-thumb-parchment-400 scrollbar-track-transparent pr-2">
      <h3 className="uppercase tracking-widest text-[10px] font-bold text-guild-secondary mb-4 flex items-center gap-2">
         <span className="w-1.5 h-1.5 bg-guild-primary rounded-full"></span> 
         Contents
      </h3>
      <ul className="space-y-2 text-sm font-sans">
        {headings.map((heading, index) => {
           let parentId = null;
           for (let i = index - 1; i >= 0; i--) {
              if (headings[i].level < heading.level) {
                parentId = headings[i].id;
                break;
              }
           }
           
           const isVisible = heading.level === 1 || (parentId && activePath.has(parentId));
           if (!isVisible) return null;

           return (
             <li
               key={heading.id}
               style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }}
             >
               <a
                 href={`#${heading.id}`}
                 className={`block py-0.5 text-xs transition-colors line-clamp-2 border-l-2 pl-3 ${
                   activeId === heading.id
                     ? "text-guild-primary font-bold border-guild-primary"
                     : "text-guild-ink/60 hover:text-guild-ink border-transparent hover:border-parchment-400"
                 }`}
               >
                 {heading.text}
               </a>
             </li>
           );
        })}
      </ul>
    </nav>
  );
}

function BlogPostView({ posts }: { posts: BlogPost[] }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = posts.find(p => p.id === id);
  const [content, setContent] = useState<string>("Loading...");
  
  const headings = useHeadings(content);
  const activeId = useScrollSpy(headings);

  useEffect(() => {
    if (!post) return;
    fetch(`/api/blog/post?path=${encodeURIComponent(post.path)}`)
      .then(res => res.text())
      .then(text => setContent(text))
      .catch(err => setContent(`Error loading markdown: ${err}`));
  }, [post]);

  if (!post) {
    return <div>Post not found</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full flex items-start gap-4 lg:gap-12 px-4 md:px-8 max-w-none pb-12"
    >
      <TableOfContents headings={headings} activeId={activeId} />
      
      <div className="flex-1 min-w-0 md:pr-[2vw] xl:pr-[5vw]">
        <button 
          onClick={() => navigate("/magic-notes")}
          className="flex items-center text-sm font-bold text-guild-secondary hover:text-guild-primary transition-colors uppercase gap-1 mb-6 font-serif"
        >
          <ArrowLeft size={16} /> Back to Magic Notes
        </button>

        <div className="bg-white/80 p-8 md:p-12 rounded-lg shadow-sm font-sans text-guild-ink break-words overflow-hidden w-full max-w-full
          prose prose-stone max-w-none 
          prose-headings:font-serif prose-headings:font-bold prose-headings:text-black
          prose-a:text-guild-primary prose-a:break-words
          prose-p:break-words prose-p:[overflow-wrap:anywhere]
          prose-img:rounded-xl prose-img:shadow-md prose-img:my-4
          prose-pre:p-0 prose-pre:bg-transparent prose-pre:overflow-x-auto
          prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-guild-primary"
        >
          <div className="border-b-2 border-parchment-300 pb-6 mb-8">
            <h1 className="text-4xl md:text-5xl text-black font-bold mb-4 font-serif leading-tight">{post.title}</h1>
            <div className="flex items-center text-guild-secondary text-[11px] font-bold uppercase tracking-widest font-sans">
              <div className="flex flex-wrap gap-2">
                {post.categories.map(c => <span key={c} className="bg-parchment-200 text-guild-secondary border border-parchment-300 px-2 py-0.5 rounded">{c}</span>)}
              </div>
            </div>
          </div>
          <div className="markdown-body text-[16px] md:text-[17px] leading-[1.8] text-[#2C2621]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeSlug, rehypeKatex, rehypeHighlight]}
              components={{
                img: ({ node, ...props }) => (
                  <Zoom>
                    <img {...props} className="mx-auto rounded-lg shadow-md max-h-[600px] object-contain" />
                  </Zoom>
                )
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function MagicNotes() {
  const [config, setConfig] = useState<BlogConfig | null>(null);

  useEffect(() => {
    fetch("/api/blog/config")
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error(err));
  }, []);

  if (!config) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-12 h-12 border-4 border-guild-primary/30 border-t-guild-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Sort posts by descending createdTs
  const sortedPosts = [...config.posts].sort((a, b) => b.createdTs - a.createdTs);

  return (
    <Routes>
      <Route path="/" element={<BlogList posts={sortedPosts} />} />
      <Route path="post/:id" element={<BlogPostView posts={sortedPosts} />} />
    </Routes>
  );
}
