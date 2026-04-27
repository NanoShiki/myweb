import { useState, useEffect } from "react";
import { Link, Route, Routes, useParams, useNavigate } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { motion } from "motion/react";
import { Calendar, Tag, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
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
                  <div className="flex items-center space-x-2 text-xs font-bold font-sans text-guild-primary uppercase mb-2">
                    <span className="w-2 h-2 bg-guild-primary rotate-45 inline-block mr-1"></span> 
                    <Calendar size={12} className="inline" />
                    <span>{post.date}</span>
                  </div>
                  
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

function BlogPostView({ posts }: { posts: BlogPost[] }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = posts.find(p => p.id === id);
  const [content, setContent] = useState<string>("Loading...");

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
      className="max-w-[80vw] w-full mx-auto space-y-6"
    >
      <button 
        onClick={() => navigate("/magic-notes")}
        className="flex items-center text-sm font-bold text-guild-primary hover:text-black transition-colors uppercase gap-1"
      >
        <ArrowLeft size={16} /> Back to Magic Notes
      </button>

      <div className="bg-white/80 p-8 md:p-12 rounded-lg shadow-sm font-sans text-guild-ink break-words overflow-hidden w-full max-w-full
        prose prose-stone prose-lg max-w-none 
        prose-headings:font-serif prose-headings:font-bold prose-headings:text-black
        prose-a:text-guild-primary prose-a:break-words
        prose-p:break-words prose-p:[overflow-wrap:anywhere]
        prose-img:rounded-xl prose-img:shadow-md
        prose-pre:p-0 prose-pre:bg-transparent prose-pre:overflow-x-auto
        prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-guild-primary"
      >
        <div className="border-b-2 border-parchment-300 pb-6 mb-8">
          <h1 className="text-4xl md:text-5xl text-black font-bold mb-4 font-serif leading-tight">{post.title}</h1>
          <div className="flex items-center text-guild-secondary text-sm font-bold">
            <span className="flex items-center gap-1.5 mr-4"><Calendar size={16} /> {post.date}</span>
            <div className="flex flex-wrap gap-2">
              {post.categories.map(c => <span key={c} className="bg-guild-primary/10 text-guild-primary px-2.5 py-1 rounded text-xs tracking-wider uppercase">{c}</span>)}
            </div>
          </div>
        </div>
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
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
