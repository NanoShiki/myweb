# Lyra UIExtension插件介绍

# 一、核心概念

## 1.1 设计思想

UIExtension 系统是一个**松耦合的 UI 扩展框架**，采用**插座-插头**模式，将"内容提供者"和"内容容器"分离。

|概念|类比|职责|
| ------| --------| ------------------------------------------------------|
|**Extension (扩展)**|插头|提供要插入的内容（Widget 或数据）|
|**ExtensionPoint (扩展点)**|插座|接收内容的位置，定义匹配规则和回调|
|**UIExtensionSubsystem**|插座板|管理所有 Extension 和 ExtensionPoint，负责匹配和通知|

## 1.2 核心类

|类名|作用|
| -----------| ---------------------------------------------|
|​`UUIExtensionSubsystem`|核心管理子系统，提供注册和匹配 API|
|​`FUIExtension`|扩展数据结构，存储要插入的内容|
|​`FUIExtensionPoint`|扩展点数据结构，存储接收位置和匹配规则|
|​`UUIExtensionPointWidget`|Widget 版的扩展点，放在 Layout 中作为"插座"|
|​`FUIExtensionHandle`​ / `FUIExtensionPointHandle`|扩展/扩展点的句柄，用于注销|

---

# 二、核心数据结构

## 2.1 FUIExtension (扩展)

```cpp
struct FUIExtension : TSharedFromThis<FUIExtension>
{
    // 要插入的扩展点 Tag
    FGameplayTag ExtensionPointTag;
    
    // 优先级，用于排序多个扩展
    int32 Priority = INDEX_NONE;
    
    // 上下文对象（如 LocalPlayer，用于分屏）
    TWeakObjectPtr<UObject> ContextObject;
    
    // 实际数据（Widget 类或数据对象）
    TObjectPtr<UObject> Data = nullptr;
};
```

**作用**：声明"我想在某个位置插入什么内容"。

## 2.2 FUIExtensionPoint (扩展点)

```cpp
struct FUIExtensionPoint : TSharedFromThis<FUIExtensionPoint>
{
    // 扩展点的 Tag
    FGameplayTag ExtensionPointTag;
    
    // 上下文对象（可选，用于过滤）
    TWeakObjectPtr<UObject> ContextObject;
    
    // 匹配规则：ExactMatch 或 PartialMatch
    EUIExtensionPointMatch ExtensionPointTagMatchType = EUIExtensionPointMatch::ExactMatch;
    
    // 允许的数据类型
    TArray<TObjectPtr<UClass>> AllowedDataClasses;
    
    // 扩展添加/移除时的回调
    FExtendExtensionPointDelegate Callback;
    
    // 检查扩展是否匹配
    bool DoesExtensionPassContract(const FUIExtension* Extension) const;
};
```

**作用**：声明"我在这里接受插入，但需要满足某些条件"。

## 2.3 匹配规则

|匹配模式|说明|示例|
| ----------| -----------------------------| -------------------------------------------------------------------------|
|​`ExactMatch`|精确匹配，Tag 必须完全相同|扩展点 Tag = "UI.Slot.Icon"，只接受 Tag = "UI.Slot.Icon" 的扩展|
|​`PartialMatch`|部分匹配，接受父 Tag 的扩展|扩展点 Tag = "UI.Slot"，接受 Tag = "UI.Slot" 或 "UI.Slot.Icon" 等的扩展|

---

# 三、完整工作流程

## 流程图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. 注册 ExtensionPoint (在 Layout 的 Slot 中)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  UUIExtensionPointWidget::RegisterExtensionPoint()                       │
│      ↓                                                                   │
│  创建 FUIExtensionPoint，包含：                                          │
│    - ExtensionPointTag (如 "UI.Slot.Inventory.Icon")                    │
│    - AllowedDataClasses (如 [UUserWidget::StaticClass()])               │
│    - Callback (OnAddOrRemoveExtension)                                  │
│      ↓                                                                   │
│  存入 ExtensionPointMap["UI.Slot.Inventory.Icon"]                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  2. 注册 Extension (在 GameFeature 或其他地方)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  GameFeatureAction_AddWidget::AddWidgets()                               │
│      ↓                                                                   │
│  ExtensionSubsystem->RegisterExtensionAsWidgetForContext(                │
│      SlotID = "UI.Slot.Inventory.Icon",                                  │
│      WidgetClass = W_MyIconWidget,                                       │
│      ContextObject = LocalPlayer                                         │
│  )                                                                       │
│      ↓                                                                   │
│  创建 FUIExtension，包含：                                               │
│    - ExtensionPointTag = "UI.Slot.Inventory.Icon"                      │
│    - Data = W_MyIconWidget                                               │
│    - ContextObject = LocalPlayer                                         │
│      ↓                                                                   │
│  存入 ExtensionMap["UI.Slot.Inventory.Icon"]                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  3. 匹配和通知 (系统自动处理)                                            │
├─────────────────────────────────────────────────────────────────────────┤
│  UUIExtensionSubsystem::NotifyExtensionPointsOfExtension()               │
│      ↓                                                                   │
│  遍历 ExtensionPointMap 中匹配的 ExtensionPoint                          │
│      ↓                                                                   │
│  对每个匹配的 ExtensionPoint 调用：                                       │
│    ExtensionPoint->DoesExtensionPassContract(Extension)                  │
│      - 检查 Tag 匹配 ✓                                                   │
│      - 检查 Context 匹配 ✓                                               │
│      - 检查 DataClass 在 AllowedDataClasses 中 ✓                         │
│      ↓                                                                   │
│  ExtensionPoint->Callback.Execute(EUIExtensionAction::Added, Request)    │
│      ↓                                                                   │
│  UUIExtensionPointWidget::OnAddOrRemoveExtension()                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  4. 创建 Widget (在 ExtensionPoint 中)                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  UUIExtensionPointWidget::OnAddOrRemoveExtension(EUIExtensionAction::Added) │
│      ↓                                                                   │
│  从 Request.Data 获取 WidgetClass                                         │
│      ↓                                                                   │
│  【关键！】调用父类 UDynamicEntryBoxBase 的：                             │
│  UUserWidget* Widget = CreateEntryInternal(WidgetClass)                 │
│      ↓                                                                   │
│  内部调用 CreateWidget<UUserWidget>(this, WidgetClass)                  │
│      ↓                                                                   │
│  将 Widget 添加到 UUIExtensionPointWidget 的容器中                        │
│      ↓                                                                   │
│  存入 ExtensionMapping[ExtensionHandle] = Widget                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 注册 Extension（代码模板）

```cpp
// 1. 获取 Subsystem
UUIExtensionSubsystem* ExtensionSubsystem = GetWorld()->GetSubsystem<UUIExtensionSubsystem>();

// 2. 注册 Widget 扩展
FUIExtensionHandle Handle = ExtensionSubsystem->RegisterExtensionAsWidgetForContext(
    FGameplayTag::RequestGameplayTag("UI.Slot.MySlot"),
    GetOwningLocalPlayer(),
    W_MyWidgetClass,
    -1  // Priority
);

// 3. 保存 Handle，用于后续注销
// ExtensionHandles.Add(Handle);
```

## 注销 Extension（代码模板）

```cpp
// 1. 使用 Handle 注销
Handle.Unregister();

// 或
ExtensionSubsystem->UnregisterExtension(Handle);
```
