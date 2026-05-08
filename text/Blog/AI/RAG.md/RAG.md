# RAG

# 理论

直接把文档塞给模型, 如果文档太长, 效果就很差.

![image](assets/image-20260508195455-a5w7wad.png)

![image](assets/image-20260508195531-9v8d3bp.png)

## 分片

![image](assets/image-20260508195603-46uin7t.png)

hello-agent采用的是先将文档转为md, 然后根据md标题结构划分段落, 然后按固定token数来收集段落.

## 索引

![image](assets/image-20260508195908-f75ctdj.png)

语义相近的文本经过embedding之后距离更近. embedding是通过专门的embedding模型实现的.

![image](assets/image-20260508200039-7ypi9xv.png)

![image](assets/image-20260508200114-smgp0j2.png)

注意, 原始文本也需要存到向量数据库, 这样在找出语义相近的向量之后, 才能对应到其原始文本.

![image](assets/image-20260508200206-mqv4mua.png)

## 召回

![image](assets/image-20260508200304-kpo5wgc.png)

![image](assets/image-20260508200348-2ozzxn5.png)

![image](assets/image-20260508200447-8jyue4q.png)

![image](assets/image-20260508200503-a4uirmy.png)

召回之后是再次挑选, 称为重排.

## 重排

召回和重排计算相似度的方法不一样. 如果只是单纯减少召回得到的结果, 效果不如召回+重排.

![image](assets/image-20260508200554-2kw9chn.png)

![image](assets/image-20260508200729-l5du20w.png)

![image](assets/image-20260508200751-fjqm65h.png)

# 代码实现

![image](assets/image-20260508201642-4ik48bm.png)

## 分片

这里是按行分片.

![image](assets/image-20260508201812-x398ylh.png)

## 索引

![image](assets/image-20260508201922-6q4vz4a.png)

这里一个片段768维. 循环调用这个函数, 对所有片段都embedding.

![image](assets/image-20260508202026-f610x38.png)

将向量与原始文本存到向量数据库.

![image](assets/image-20260508202156-dzuwy70.png)

## 召回

![image](assets/image-20260508202308-xks53id.png)

![image](assets/image-20260508202424-8mxd9ct.png)

## 重排

![image](assets/image-20260508202611-g4iym20.png)

![image](assets/image-20260508202627-ldrop5q.png)
