# MCP vs FunctionCall

## Function Call 是什么

调用模型的时候，用 JSON 的形式告诉它：我有哪些函数、每个函数有哪些参数。模型如果判断需要调用某个函数，就返回一段符合格式的 JSON，里面写明调用哪个函数、传什么参数。你拿到这段 JSON，自己去执行对应的函数，把结果再塞回上下文，模型继续往下走。

这就是 function call 的全部机制。工具是你自己写的，调用格式是你自己定的，执行也是你自己做的。

## MCP 是什么

MCP 是给某个软件或服务打包一套工具，然后对外暴露成一个 Server。比如 GitHub MCP，里面可能有"克隆仓库"、"搜索仓库"、"提交 PR"这些工具。

想用这套工具的人，直接安装这个 MCP Server 就行，不需要自己写 GitHub 集成。

调用模型的时候，MCP 用的还是 function call 那套机制——工具描述按 JSON 格式传给模型，模型需要调用就返回对应的 JSON，MCP Client 接收到这段 JSON，再拿参数去调用 MCP Server 上的函数，拿到结果返回来。只不过由于各家的FunctionCall格式不一定相同, 所以MCP定义了自己的格式. 适配MCP的Agent(比如ClaudeCode)会在调用模型的时候将MCP的格式转为平台支持的FunctionCall格式, 等模型返回FunctionCall的json时, 再解析为MCP的格式, 传给MCP Client.

另外, MCP Server也分本地(stdio)和远程(http/sse), 大多数现在流行的 MCP Server（比如 GitHub MCP）默认是本地跑的，不是远程调用。

## 两者的关系

Function call 是机制，MCP 是在这个机制上建的生态协议。

如果只有 function call，你需要自己写所有工具，自己在调用模型时传工具描述，自己执行。而且各平台的 function call 格式不一样，换个平台就得重新适配。你写的工具想让别人用，也只能让别人把代码下载下来，没法远程调用。如果非要实现远程调用，那你的工具本身就得充当 MCP Client 的角色，负责去调服务端的接口——绕了一圈，其实就是在手动复现 MCP 做的事。

MCP 解决的是这些问题：工具有人写好了你直接装，格式统一了不用适配各平台。

## MCP 的价值

核心价值不是"让模型能调用工具"——function call 已经做到了。MCP 的价值是**工具可以复用、可以共享、可以跨平台**。

一个 MCP Server 写好之后，所有支持 MCP 协议的客户端——Claude Desktop、Cursor、VS Code 插件——都能直接用，不需要为每个平台单独适配。这是生态协议的意义，不是调用机制的意义。
