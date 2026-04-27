#!/usr/bin/env python3
import os
import json
import re
from datetime import datetime

NATURAL_SPLIT_RE = re.compile(r'(\d+)')


def natural_sort_key(name):
    """按名称自然排序（例如 _2 在 _10 前）"""
    parts = NATURAL_SPLIT_RE.split(name)
    return [int(p) if p.isdigit() else p.lower() for p in parts]


def iter_ordered_subdirs(path):
    """返回目录下按项目文件夹名称自然排序后的子目录名列表"""
    items = [name for name in os.listdir(path) if os.path.isdir(os.path.join(path, name))]
    return sorted(items, key=natural_sort_key)


def extract_title_from_md(md_file_path):
    """从 Markdown 文件中提取标题"""
    try:
        with open(md_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('# '):
                    return line[2:].strip()
    except Exception as e:
        print(f"读取文件 {md_file_path} 失败: {e}")
    return None


def get_folder_created_ts(folder_path):
    """获取目录创建时间（优先 birthtime，回退 ctime）"""
    stat_result = os.stat(folder_path)
    created_ts = getattr(stat_result, 'st_birthtime', None)
    if created_ts is None:
        created_ts = stat_result.st_ctime
    return float(created_ts)


def get_post_folder_name(post):
    trimmed = post.get("path", "").rstrip("/")
    if not trimmed:
        return ""
    return trimmed.split("/")[-1]


def sort_posts(posts):
    """
    统一文章排序：
    1) createdTs 降序（新到旧）
    2) folderName 降序（例如 3 -> 2 -> 1）
    3) path 降序（稳定兜底）
    """
    posts.sort(
        key=lambda post: (
            int(post.get("createdTs", 0)),
            get_post_folder_name(post),
            post.get("path", "")
        ),
        reverse=True
    )
    return posts


def build_post(item_path, rel_path_parts, categories):
    folder_name = rel_path_parts[-1]
    md_file = os.path.join(item_path, f"{folder_name}.md")
    if not os.path.exists(md_file):
        return None

    created_ts = get_folder_created_ts(item_path)
    title = extract_title_from_md(md_file)
    if title is None:
        title = folder_name

    rel_path = '/'.join(rel_path_parts)
    return {
        "id": '_'.join(rel_path_parts),
        "title": title,
        "date": datetime.fromtimestamp(created_ts).strftime('%Y-%m-%d'),
        "createdTs": int(created_ts),
        "path": f"/Blog/archive/{rel_path}/",
        "categories": categories
    }


def find_posts_recursive(root_dir, current_dir, categories=None):
    if categories is None:
        categories = []

    found_posts = []
    full_path = os.path.join(root_dir, *categories, current_dir) if categories else os.path.join(root_dir, current_dir)

    for item in iter_ordered_subdirs(full_path):
        item_path = os.path.join(full_path, item)
        rel_path_parts = categories + [current_dir, item] if categories else [current_dir, item]
        next_categories = categories + [current_dir] if categories else [current_dir]

        post = build_post(item_path, rel_path_parts, next_categories)
        if post is not None:
            found_posts.append(post)
        else:
            found_posts.extend(find_posts_recursive(root_dir, item, next_categories))

    return found_posts


def build_tree_from_posts(posts):
    tree = {
        'name': 'root',
        'type': 'category',
        'children': [],
        'posts': []
    }
    
    category_map = {}
    
    for post in posts:
        current = tree
        path = ['root']
        
        for i, cat in enumerate(post['categories']):
            path.append(cat)
            path_key = '/'.join(path)
            
            if path_key not in category_map:
                new_node = {
                    'name': cat,
                    'type': 'category',
                    'children': [],
                    'posts': []
                }
                category_map[path_key] = new_node
                current['children'].append(new_node)
            
            current = category_map[path_key]
        
        current['posts'].append(post)
    
    for node in category_map.values():
        sort_posts(node['posts'])
        node['children'].sort(key=lambda x: natural_sort_key(x["name"]))
    
    tree['children'].sort(key=lambda x: natural_sort_key(x["name"]))
    
    return tree

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    archive_dir = os.path.join(script_dir, 'archive')
    config_path = os.path.join(script_dir, 'config.json')

    site_config = {
        "title": "如珩的博客",
        "subtitle": "技术笔记与分享",
        "author": "如珩"
    }

    posts = []

    if os.path.exists(archive_dir):
        for item in iter_ordered_subdirs(archive_dir):
            item_path = os.path.join(archive_dir, item)
            post = build_post(item_path, [item], [])
            if post is not None:
                posts.append(post)
            else:
                posts.extend(find_posts_recursive(archive_dir, item))

    sort_posts(posts)
    category_tree = build_tree_from_posts(posts)

    config = {
        "site": site_config,
        "posts": posts,
        "categoryTree": category_tree
    }

    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    print(f"成功更新 config.json，共发现 {len(posts)} 篇文章")

if __name__ == "__main__":
    main()
