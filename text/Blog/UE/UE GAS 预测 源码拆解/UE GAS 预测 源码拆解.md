---
date: 2026-05-22
zhihu-title: UE GAS 预测 源码拆解
zhihu-topics:
  - UE
  - GAS
zhihu-link: https://zhuanlan.zhihu.com/p/2041254240207856185
zhihu-created-at: 2026-05-22 20:29
---
推荐先了解一下GAS预测的基本流程, 可以参考以下文章:
[【Unreal】GAS 网络同步 - 知乎](https://zhuanlan.zhihu.com/p/27727604723)
[UE4的GAS探究三：弱网延迟与预测Prediction - 知乎](https://zhuanlan.zhihu.com/p/458192589)

本文更侧重于"GAS如何实现预测", 对于原理的讲解可能不如其他文章.
思路是照着官方注释的顺序拆解源码.
注释来自UE5.7, GameplayPrediction.h, gpt5.5翻译

# 概览
```
/**
 *
 * Gameplay Ability 预测概览
 *
 * 高层目标：
 * 在 GameplayAbility 层面，也就是实现一个能力时，预测应当是透明(transparent)的。一个能力只需要说“做 X -> Y -> Z”，系统会自动预测其中能够预测的部分。
 * 我们希望避免在能力自身逻辑里写类似 “如果是 Authority：做 X；否则：做 X 的预测版本” 这样的分支。
 *
 * 到目前为止，并不是所有情况都已经解决，但我们已经有了一个非常扎实的客户端预测框架。
 *
 * 当我们说“客户端预测”时，真正指的是客户端预测游戏模拟状态。有些东西仍然可以是“完全客户端侧”的，而不需要进入预测系统。
 * 例如，脚步声就是完全客户端侧的，永远不会和这个预测系统交互。但客户端在施法时预测自己的法力值从 100 变成 90，这才属于“客户端预测”。
 *
 * 当前我们会预测什么？
 * - 初始 GameplayAbility 激活，以及带有一些限制的链式激活
 * - 触发事件
 * - GameplayEffect 的应用：
 *     - 属性修改
 *       例外：Executions 目前不会预测，只预测属性 modifier
 *     - GameplayTag 修改
 * - GameplayCue 事件，包括预测 GameplayEffect 内部触发的 Cue，以及独立触发的 Cue
 *
 * - Montage
 * - 移动，内置在 UE 的 UCharacterMovement 中
 *
 *
 * 有些东西我们不预测，大多数理论上可以预测，但目前没有做：
 * - GameplayEffect 移除
 * - GameplayEffect 周期效果，比如 DOT 的 tick
 *
 *
 * 我们试图解决的问题：
 * 1. “我能做这件事吗？” 预测的基础协议。
 * 2. “撤销” 当预测失败时，如何撤销副作用。
 * 3. “重做” 如何避免重复播放那些我们已经在本地预测过、但又从服务器复制回来的副作用。
 * 4. “完整性” 如何确认我们真的预测了所有副作用。
 * 5. “依赖” 如何管理依赖式预测，以及预测事件链。
 * 6. “覆盖” 如何以预测方式覆盖那些本来由服务器复制或拥有的状态。
 *
 * ---------------------------------------------------------
```
通过这个概述, 可以大致了解这个预测框架目前的基本情况. 不过还是比较浅, 还得具体看实现细节.

在继续讲解之前, 先讲一下关键术语:
1. 什么叫"预测". 简单举例: 我按下R准备放大招, 这时候如果不预测, 那么客户端会先向服务器发送放大招的请求, 等服务器同意了, 才在本地显示放大招的动画和效果. 如果预测, 那么客户端直接播放大招动画和效果, 同时向服务器发送请求. 如果服务器同意了, 那就OK. 如果不同意, 那么就需要客户端把刚刚播放的动画和效果都回滚. 类似这种客户端先斩后奏的情况就叫预测.
2. 什么叫"副作用". 在注释中出现了很多次. 这里的副作用side effect, 可以理解为, 放技能的时候附带的效果. 比如"大招"本身是一个技能, 被激活的时候, 会额外做"播放动画"和"对敌人造成伤害"这两件事情. 那么这两件事情就是副作用. 在GAS中, 这里讲的"大招"对应GameplayAbility, "播放动画"对应GameplayCue, "对敌人造成伤害"对应GameplayEffect.

在GAS中, 预测基本围绕着GameplayAbility展开, 并进一步预测GameplayAbility所产生的副作用. 

# PredictionKey 预测键
```
 *
 * *** PredictionKey ***
 *
 * 这个系统中的一个基础概念是 Prediction Key，也就是 FPredictionKey。
 * PredictionKey 本身只是一个唯一 ID，它在客户端的中心位置生成。客户端会把自己的 PredictionKey 发送给服务器，
 * 并把预测性动作和副作用都关联到这个 key 上。服务器可能会对这个 PredictionKey 返回接受或拒绝，
 * 同时也会把服务器侧创建的副作用关联到这个 PredictionKey 上。
 *
 * 重要：FPredictionKey 总是会从客户端复制到服务器，但当它从服务器复制到客户端时，
 * 它只会复制给最初把这个 PredictionKey 发送给服务器的那个客户端。
 * 这发生在 FPredictionKey::NetSerialize 中。
 * 当一个客户端发送的 PredictionKey 通过复制属性从服务器复制回来时，所有其他客户端都会收到一个无效的，也就是 0 的 PredictionKey。
 *
```
还有对FPredictionKey的注释, 基本和上面的注释差不多, 但是更详细:
```
/**
 *  FPredictionKey 是 GameplayAbility 系统中支持客户端预测的一种通用方式。
 *  FPredictionKey 本质上是一个 ID，用来标识客户端上执行的预测性动作以及这些动作产生的副作用。
 *  UAbilitySystemComponent 支持在客户端和服务器之间同步 PredictionKey 以及与它关联的副作用。
 *
 *  本质上，任何东西都可以和一个 PredictionKey 关联，例如激活一个 Ability。
 *  客户端可以生成一个新的 PredictionKey，并在调用 ServerTryActivateAbility 时把它发送给服务器。
 *  服务器可以确认或拒绝这次调用，即 ClientActivateAbilitySucceed / Failed。
 *
 *  当客户端正在预测它的 Ability 时，它会创建一些副作用，例如 GameplayEffects、TriggeredEvents、Animations 等。
 *  客户端在预测这些副作用时，会把每一个副作用都关联到 Ability 激活开始时生成的那个 PredictionKey 上。
 *
 *  如果 Ability 激活被拒绝，客户端可以立即回滚这些副作用。
 *  如果 Ability 激活被接受，客户端必须等待复制的副作用从服务器发送回来。
 *      ClientActivatableAbilitySucceed RPC 会立即发送，而属性复制可能会晚几帧发生。
 *      一旦服务器创建的副作用复制完成，客户端就可以撤销自己本地的预测性副作用。
 *
 *  FPredictionKey 本身主要提供：
 *      - 唯一 ID，以及一套支持 PredictionKey 依赖链的系统，也就是 “Current” 和 “Base” 整数。
 *      - 一个特殊的 ::NetSerialize 实现，*** 只会把 PredictionKey 序列化给进行预测的那个客户端 ***。
 *          - 这一点很重要，因为它允许我们在复制状态中序列化 PredictionKey，
 *            并且知道只有最初把这个 PredictionKey 给到服务器的客户端，才真正能看到它！
 *
 */
```
要点总结: 
1. PredictionKey由客户端生成, 并由客户端在调用 ServerTryActivateAbility 时将其发送给服务器. (问题1: 如何生成PredictionKey的?)
2. 客户端将自己预测性的动作以及副作用关联到这个Key. (问题2: 如何将副作用关联到Key)
3. 服务器将实际创建的副作用关联到客户端发给它的这个Key. 
4. PredictionKey从服务器同步给客户端的时候, 无关的客户端只会收到无效的Key. 这部分实现在FPredictionKey::NetSerialize. (问题3: 这个NetSerialize实现长啥样)
5. 回滚副作用, 以及撤销副作用, 都依赖于他们所关联到的key. (问题4: 如何实现回滚的)

先看预测键的结构体(做了一些精简):
```cpp
struct FPredictionKey  
{  
    typedef int16 KeyType;  
  
    /** The unique ID of this prediction key */  
    UPROPERTY()  
    int16  Current = 0;  
  
    /** If non 0, the original prediction key this was created from (in a dependency chain) */  
    UPROPERTY(NotReplicated)  
    int16  Base = 0;  
  
    /** True if this was created as a server initiated activation key, used to identify server activations but cannot be used for prediction */  
    UPROPERTY()  
    bool bIsServerInitiated = false;  
    
    /** Construct a new prediction key with no dependencies */  
	static UE_API FPredictionKey CreateNewPredictionKey(const UAbilitySystemComponent*);  
	  
	/** Construct a new server initiation key, for abilities activated on the server */  
	static UE_API FPredictionKey CreateNewServerInitiatedKey(const UAbilitySystemComponent*);
	
	/** Create a new dependent prediction key: keep our existing base or use the current key as the base. */  
	UE_API void GenerateDependentPredictionKey();  
	  
	/** Creates new delegate called only when this key is rejected. */  
	UE_API FPredictionKeyEvent& NewRejectedDelegate();  
	  
	/** Creates new delegate called only when replicated state catches up to this key. */  
	UE_API FPredictionKeyEvent& NewCaughtUpDelegate();  
	  
	/** Add a new delegate that is called if the key is rejected or caught up to. */  
	UE_API void NewRejectOrCaughtUpDelegate(FPredictionKeyEvent Event);

    UE_API bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess);  
  
    /** A key was generated by the local client if it's valid and not a server key, prediction keys for other clients will serialize down as 0 and be invalid */  
    bool IsLocalClientKey() const  
    {  
       return Current > 0 && !bIsServerInitiated;  
    }  
  
    /** Can this key be used for more predictive actions, or has it already been sent off to the server? */  
    bool IsValidForMorePrediction() const  
    {  
       return IsLocalClientKey();  
    }  
  
    /** Was this PredictionKey received from a NetSerialize or created locally? */  
    bool WasReceived() const  
    {  
       return PredictiveConnectionObjectKey != FObjectKey();  
    }  
  
    bool WasLocallyGenerated() const  
    {  
       return (Current > 0) && (PredictiveConnectionObjectKey == FObjectKey());  
    }  
  
    uint64 GetPredictiveConnectionKey() const   
{ #if UE_WITH_REMOTE_OBJECT_HANDLE  
       return BitCast<uint64>(PredictiveConnectionObjectKey.GetRemoteId());  
#else  
       return BitCast<uint64>(PredictiveConnectionObjectKey);  
#endif  
    }  
  
private:  
    friend UE::Net::FPredictionKeyNetSerializer;  
  
	UE_API void GenerateNewPredictionKey();  
	  
	explicit FPredictionKey(int32 Key)  
	    : Current(static_cast<KeyType>(Key))  
	{  
	    check(Key >= 0 && Key <= std::numeric_limits<KeyType>::max());  
	}
  
    /** On the server, uniquely identifies network connection this was serialized on/from.  See NetSerialize for additional information. */  
    FObjectKey PredictiveConnectionObjectKey;  
};
```
要点总结:
1. 用Current字段标识这个key的ID.
2. 用Base字段标识这个Key由哪个Key派生. (在某些情况下会有Ability激活链. 比如技能A会进一步激活技能B, 技能B进一步激活技能C, 那么技能A的Base是0, 技能B的Base是技能A的Key的Current, 技能C的Base是技能B的Key的Current)
3. bIsServerInitiated标识这个Key是否是由服务器生成的. (并非所有Ability都在客户端激活. 对于需要在服务器上激活的Ability, 不需要做预测, 但我们也为其创建Key, 此时这个Key只有追踪作用, 即副作用依旧关联到这个Key)
4. 一些用于创建Key的接口函数.
5. 一些用于创建委托的接口函数. 一个key对应两类委托: Reject和Caught. 你可以先理解为, Reject委托就是服务器认为客户端的预测不对, 需要客户端回滚, 就广播这个Reject委托. Caught委托就是服务器认为客户端是对的, 然后服务器也执行完了客户端预测的代码, 这时候广播Caught委托, 表示"服务器追上客户端了"
6. 同步相关, 比如PredictiveConnectionObjectKey, NetSerialize.

这里涉及三件事情: Key生成, 委托, 网络同步(序列化). 下面一一讲解.

## Key生成与预测窗口.

Key的创建机制是基于cpp的函数内static变量:
![[Pasted image 20260515175125.png]]
每次调用这个函数, GKey的值就会+1.
接口函数基本就是变着花样调用这个函数.
![[Pasted image 20260515175312.png]]
注意, 对于ServerInitiatedKey, 用了另一个static变量, 与客户端用于预测的key做区分.

**预测窗口**

而负责调用这俩函数的, 是另一个数据结构:
```cpp
struct FScopedPredictionWindow  
{  
    UE_API FScopedPredictionWindow(UAbilitySystemComponent* AbilitySystemComponent, FPredictionKey InPredictionKey, bool InSetReplicatedPredictionKey = true);  
    UE_API FScopedPredictionWindow(UAbilitySystemComponent* AbilitySystemComponent, bool CanGenerateNewKey=true);  
    UE_API ~FScopedPredictionWindow();  
private:  
    TWeakObjectPtr<UAbilitySystemComponent> Owner;  
    bool ClearScopedPredictionKey;  
    bool SetReplicatedPredictionKey;  
    FPredictionKey RestoreKey;  
};
```
要点总结:
1. 两个构造函数, 一个析构函数. 一般用法是, 在要预测的时候, 创建一个作用域(可以是if语句的body, 总之就是用大括号包起来), 然后在其中创建一个FScopedPredictionWindow变量, 这样就触发了构造函数(根据传的参数选择调用哪个构造函数). 之后开始写预测代码. 等出了这个作用域, 触发析构函数. 
2. 这两个构造函数, 第一个是给服务器用的, 第二个是给客户端用的.
3. 可以简单认为构造函数是创建PredictionKey, 析构函数是让PredictionKey从服务器同步回客户端.
4. Owner指向ASC.
5. SetReplicatedPredictionKey控制析构函数中PredictionKey是否要从服务器同步回客户端. 
6. ClearScopedPredictionKey和RestoreKey下面讲.

看下客户端用的构造函数:
![[Pasted image 20260515202053.png]]
要点总结:
1. 将SetReplicatedPredictionKey设置为false. 显然, 如果客户端创建了一个预测窗口, 执行预测代码, 然后出了作用域, 此时触发预测窗口的析构函数, 不需要让PredictionKey从服务器同步回客户端. 因为这个同步操作应当由服务器来完成.
2. ClearScopedPredictionKey和RestoreKey配套使用. 如果创建预测窗口的时候第二个参数设置为true, 那么会将ASC当前存储的Key存到RestoreKey, 然后调用Key的接口函数来产生新Key(新的Key会以当前ASC的Key为Base), 并将ClearScopedPredictionKey设置为true. 之后在析构函数中会判断ClearScopedPredictionKey是否为true, 如果是的话, 将ASC的Key重新复原回RestoreKey.

看下服务器的构造函数:
![[Pasted image 20260515204522.png]]
其实做的事情跟客户端的区别不大, 只是SetReplicatedPredictionKey的值可能不同. 默认情况下会是true, 也就是在析构的时候将Key同步回客户端. 

不过, 也有不需要同步回客户端, SetReplicatedPredictionKey为false的情况. 

具体来说, 一个Key, 不仅仅是一个ID, 还关联了所有在本次预测窗口中产生的副作用. 

如果说你开了一个预测窗口, 这个预测窗口内执行了一个异步任务, 并且这个异步任务将产生一些需要关联到这个key的副作用. 但是如果这个预测窗口结束的时候, 异步任务还没产生该产生的副作用, 那么这部分副作用就来不及关联到这个key上了.  此时, 就需要在异步任务产生副作用的前一刻, 重新创建一个以这个key为参数的预测窗口, 这样就能顺利地将这些副作用关联到这个key. 并且此时不需要再次将这个key同步回客户端, 因此构造函数的第三个参数传false, 也就是SetReplicatedPredictionKey为false的情况.

这种情况多出现在AbilityTask中. 以AbilityTask_WaitTargetData为例. 在其Activate函数会监听TargetData的变化. 

假如有一个Ability, 激活之后会先执行PlayMontageAndWait(也是一个AbilityTask), 等Montage播放完毕之后, 执行WaitTargetData.

那么客户端走的流程:
1. 客户端创建预测窗口, 将Key传给服务器, 然后开始预测激活这个Ability, 执行PlayMontageAndWait, Montage播放完毕后执行WaitTargetData. 
2. 客户端拿到TargetData, 创建一个新的预测窗口, 将新的Key和TargetData传给服务器, 然后广播WaitTargetData监听的委托.

服务器走的流程:
1. 服务器拿到第一个Key, 用这个Key创建预测窗口. 开始激活Ability, 执行PlayMontageAndWait, Montage播放完毕后执行WaitTargetData. 
2. 服务器拿到第二个Key和TargetData, 用这个Key创建新的预测窗口, 广播WaitTargetData监听的委托, 然后窗口结束.

此时出现问题: 服务器广播WaitTargetData监听的委托的时候, 服务器上的Montage可能还没播放完. 那么等WaitTargetData开始监听的时候已经晚了.

所以服务器会将拿到的TargetData和Key都缓存下来, WaitTargetData内部在Activate的时候不止是开始监听, 还会尝试访问一下缓存. 如果缓存中有TargetData了, 那说明预测窗口已经结束, key已经同步回客户端了. 所以此时会以缓存中的Key为参数创建预测窗口, 再执行后续操作. 这时候不需要再次将这个Key同步回客户端了, 因此预测窗口的构造函数的第三个参数传false.
![[Pasted image 20260515223237.png]]
关于这个服务器的构造函数, 可以看下作者对这个函数的注释:
```
/**   
 * This is the Server version of FScopedPredictionWindow constructor.  
 * This exists for legacy reasons and I'm not convinced this needs to exist.  Instead we should manually accept/reject the FPredictionKey (currently done in the destructor). 
 */
```

最后来看看析构函数:
![[Pasted image 20260515233319.png]]
大部分在前面已经讲过了. 不过有一个关键点, 就是预测键的同步, 引入了一个ReplicatedPredictionKeyMap.
```cpp
/** PredictionKeys, see more info in GameplayPrediction.h. This has to come *last* in all replicated properties on the AbilitySystemComponent to ensure OnRep/callback order. */  
UPROPERTY(Replicated, Transient)  
FReplicatedPredictionKeyMap ReplicatedPredictionKeyMap;
```
ASC中对其的注释如上, 大概意思就是这个Map需要放在 ASC 所有复制属性的最后，保证其他副作用状态，比如 GE / Tag / Cue. 等副作用同步到客户端之后, 再将预测键同步到客户端, 表示对于当前预测窗口执行的行为, 服务器已经追上了客户端.

这玩意的结构体如下:
```cpp
/**
 *  这是一个用于把 prediction key 从服务器复制回客户端的数据结构
 *  也就是通过属性复制 property replication 从 server -> client。
 *
 *  这里使用 FastArray，是为了让每一个 prediction key 都能被单独确认 ack，
 *  而不是只复制一个“当前已确认的最大 key 值”。
 *
 *  只复制“最大 key 值”在丢包情况下会出问题。例如：
 *
 *  Pkt1: {+Tag=X, ReplicatedKey=1)
 *  Pkt2: (ReplicatedKey=2)
 *
 *  如果 Pkt1 丢了，而 Pkt2 已经在路上并且先被客户端收到了，
 *  客户端收到 ReplicatedKey=2 后，就会认为自己已经追上了服务器状态，
 *  于是会移除本地预测出来的 Tag=X。
 *
 *  之后，当网络层检测到 Pkt1 丢失并重新发送时，
 *  Pkt1 里的真实服务器状态才会补发过来。
 *
 *  但这时问题已经发生了：
 *  客户端之前以为自己已经同步到了最新状态，
 *  可实际上中间漏掉了一包，也就是漏掉了 ReplicatedKey=1 对应的状态。
 */
struct FReplicatedPredictionKeyMap;  
  
USTRUCT()  
struct FReplicatedPredictionKeyItem : public FFastArraySerializerItem  
{  
    GENERATED_USTRUCT_BODY()  
  
    // As we know that FReplicatedPredictionKeyItem is well behaved and does not leak outside of FReplicatedPredictionKeyMap we allow ReplicationID and ReplicationKey to be copied around to avoid issues when instantiating from archetype or CDO  
    FReplicatedPredictionKeyItem();  
    FReplicatedPredictionKeyItem(const FReplicatedPredictionKeyItem& Other);  
    FReplicatedPredictionKeyItem(FReplicatedPredictionKeyItem&& Other);  
    FReplicatedPredictionKeyItem& operator=(FReplicatedPredictionKeyItem&& other);  
    FReplicatedPredictionKeyItem& operator=(const FReplicatedPredictionKeyItem& other);  
  
    UPROPERTY()  
    FPredictionKey PredictionKey;  
      
    void PostReplicatedAdd(const struct FReplicatedPredictionKeyMap &InArray) { OnRep(InArray); }  
    void PostReplicatedChange(const struct FReplicatedPredictionKeyMap &InArray) { OnRep(InArray); }  
  
    FString GetDebugString() { return PredictionKey.ToString(); }  
  
private:  
  
    void OnRep(const struct FReplicatedPredictionKeyMap& InArray);  
};  
  
USTRUCT()  
struct FReplicatedPredictionKeyMap : public FFastArraySerializer  
{  
    GENERATED_USTRUCT_BODY()  
  
    FReplicatedPredictionKeyMap();  
  
    UPROPERTY()  
    TArray<FReplicatedPredictionKeyItem> PredictionKeys;  
  
    void ReplicatePredictionKey(FPredictionKey Key);  
  
    bool NetDeltaSerialize(FNetDeltaSerializeInfo & DeltaParms);  
  
    FString GetDebugString() const;  
  
    static const int32 KeyRingBufferSize;  
  
      
};  
  
template<>  
struct TStructOpsTypeTraits< FReplicatedPredictionKeyMap > : public TStructOpsTypeTraitsBase2< FReplicatedPredictionKeyMap >  
{  
    enum  
    {  
       WithNetDeltaSerializer = true,  
    };  
};
```
要点总结:
1. 哎哟我, 死去的计网在攻击我. 
2. Map是个FastArray, 其内的元素是FastArrayItem. 对于FastArray我也不太了解, 这里先简单理解为对于FastArray内每个元素都会有自己的OnRep函数, 而普通Array则只有数组本身有OnRep函数. (这里说的每个元素都有自己的OnRep, 指的是Item结构体内的PostReplicatedAdd和PostReplicatedChange这俩函数)
3. Map使用自己的NetDeltaSerializer (如果一个 struct 声明了WithNetDeltaSerializer = true, UE 就会在复制这个 struct 属性时调用它的NetDeltaSerialize)
4. Map是个环形数组. 数组大小为KeyRingBufferSize.

回到前面, 析构函数调用了Map的ReplicatePredictionKey, 将对应key标脏.
![[Pasted image 20260517121512.png]]
待同步到客户端之后, 触发Item的OnRep函数. 在Item的OnRep函数中, 会执行CaughtUp委托:
![[Pasted image 20260517144349.png]]
(这里的CatchUpTo就是广播CaughtUp委托)
![[Pasted image 20260517145630.png]]
以上就是预测窗口做的事情: 构造的时候创建Key, 将Key赋给ASC, 析构的时候将Key同步到客户端, 广播CaughtUp委托, 还原ASC的Key.

另外提一嘴, 预测键在ASC中被设置为尽可能最后被同步. 因为一旦预测键被同步到客户端, 就会执行回滚操作, 所以要确保副作用先同步到客户端.
![[Pasted image 20260520111209.png]]

## 委托

一个Key对应两个类型的委托: Rejected和CaughtUp. 
```cpp
	/** Creates new delegate called only when this key is rejected. */  
	UE_API FPredictionKeyEvent& NewRejectedDelegate();  
	  
	/** Creates new delegate called only when replicated state catches up to this key. */  
	UE_API FPredictionKeyEvent& NewCaughtUpDelegate();  
	  
	/** Add a new delegate that is called if the key is rejected or caught up to. */  
	UE_API void NewRejectOrCaughtUpDelegate(FPredictionKeyEvent Event);
```
这俩委托就是实现"回滚"的关键. 当预测被服务器拒绝, 或者预测被服务器跟上的时候, 分别触发这俩委托.
(什么叫"预测被服务器跟上"? 简单来说就是客户端执行的预测代码, 服务器也都执行完毕了. CaughtUp委托在预测键被同步到客户端的时候触发, 这个前面也提过了).

GAS专门定义了一个结构体来管理Key与这俩类型委托的对应关系. 
![[Pasted image 20260517152410.png]]
要点总结:
1. 很经典的单例设计.
2. 一个Key对应两个Delegate数组
3. 想要为key新增委托, 需要先获取这个单例, 调用接口函数. 接口函数会往这个key的对应数组中新增委托.

有一个比较特别的: AddDependency. 
前面提到, Key有一个Base字段, 并且在客户端的预测窗口的构造函数中, 产生新key使用的是GenerateDependentPredictionKey. 这样实现了Key的链式关联.
实际上在GenerateDependentPredictionKey函数中, 调用了AddDependency.
![[Pasted image 20260517152820.png]]
AddDependency让委托之间也有链式关联.
![[Pasted image 20260517152926.png]]
要点总结:
1. 当父Key被拒绝, 那么子Key也应当被拒绝. 即父Key的Reject委托被广播了, 那么也广播子Key的Reject委托.
2. 当子Key被赶上, 那么说明父Key也被赶上了. 即子Key的CaughtUp委托被广播了, 那么也广播父Key的CaughtUp委托.
3. 当父Key被赶上, 也让子Key被赶上. 这一条显然逻辑是不对的. GAS有一部分操作是有产生子Key, 但只将父Key发送给服务器. 这样的话服务器只会通知客户端父Key被赶上了, 但是子Key就会一直不通知. 这一条逻辑是兼容这个情况的. 注释中也说了正在引入新的方法来替代这个做法.

**委托广播时机**

CaughtUp委托的广播时机前面已经讲过了, 就是预测键同步到客户端的时候广播.

Reject委托的广播时机则是在ClientActivateAbilityFailed. 也就是服务器认为客户端预测是错误的, 调用这个客户端RPC.
![[Pasted image 20260517160037.png]]
![[Pasted image 20260517155945.png]]

委托广播时机我们已经清楚了, 现在的问题就是回滚是怎么实现的. 我打算放到后面讲, 在这里继续展开的话已经不属于"预测键"的范畴了. 不过虽然只讲了预测键, 但我感觉此时我们对于整个GAS的网络同步的实现已经摸得很清楚了

## 网络同步(序列化)

回顾一下Key那部分的注释. 当Key同步回客户端的时候, 无关的客户端只会收到无效的Key. 这部分的实现是在Key的NetSerialize函数.

回顾一下Key的结构, 对于序列化这块有以下要点:
1. Base不需要序列化. 仅在客户端本地存储Base关系.
2. 使用PredictiveConnectionObjectKey来记录生成这个Key的客户端是谁.

这里稍微讲一下NetSerialize的基础. 简单来说就是我们在传输的时候需要把定义的这些结构体变量转为字节流. 这叫序列化. 反序列化就是用拿到的字节流构建出结构体变量.

一般来说NetSerialize函数内会同时包含序列化和反序列化的逻辑. 用Ar.IsSaving()来判断当前是否处于序列化, 用Ar.IsLoading()来判断当前是否处于反序列化.

然后来看Key的NetSerialize:

首先, 如果正在序列化, 那么先判断是否要同步有效key给对方. 判断方式如下:
1. PredictiveConnectionObjectKey如果为空, 说明此时是客户端向服务器发送Key. 认为OK.
2. PredictiveConnectionObjectKey如果不为空, 说明此时是服务器向客户端发送Key, 那么就看PredictiveConnectionObjectKey和对方是否是同一个. 如果是那就OK. 
3. 如果bIsServerInitiated=true, 说明此时是服务器向所有客户端发送Key. 认为OK.
然后把判断结果存到Ar.
![[Pasted image 20260517171252.png]]
然后把bIsServerInitiated存到Ar, 或从Ar中读取. 
然后对于有效的Connection, 把Current存到Ar, 或从Ar中读取.
(`<<`和`SerializeBits`都是当Ar为Saving的时候代表写, Loading的时候代表读)
![[Pasted image 20260517172433.png]]
最后, 在本地将ObjectKey存到PredictiveConnectionObjectKey字段. 

这样就实现了Key的正确传输.

至此, 我们前面提的四个问题基本都能轻松回答了.

# GameplayAbility激活
```
 *
 * *** Ability Activation ***
 *
 * Ability 激活是一等预测动作，它会生成一个初始 PredictionKey。
 * 每当客户端以预测方式激活一个能力时，它会显式询问服务器，服务器也会显式响应。
 * 一旦能力已经被预测激活，但请求还没有真正发送出去，客户端就拥有一个有效的“预测窗口”。
 * 在这个窗口内，可以发生一些预测性副作用，而这些副作用不会被单独显式询问。
 * 例如，我们不会显式询问“我能不能减少 mana？”、“我能不能把这个 ability 放进 cooldown？”
 * 这些动作在逻辑上被认为和 ability 激活是原子性的。
 *
 * 你可以把这个预测窗口理解为 ActivateAbility 的初始调用栈。
 * 一旦 ActivateAbility 结束，你的预测窗口，也就是你的 PredictionKey，就不再有效。
 * 这很重要，因为很多东西都会让你的预测窗口失效，比如 Blueprint 中的 timer 或 latent node。
 * 我们不会跨多个帧进行预测。
 *
 *
 * AbilitySystemComponent 提供了一组函数，用于在客户端和服务器之间通信 ability 激活：
 * TryActivateAbility -> ServerTryActivateAbility -> ClientActivateAbility(Failed/Succeed)。
 *
 * 1. 客户端调用 TryActivateAbility，这会生成一个新的 FPredictionKey，并调用 ServerTryActivateAbility。
 * 2. 客户端在收到服务器响应之前继续执行，并调用 ActivateAbility，同时把生成的 PredictionKey 关联到 Ability 的 ActivationInfo 上。
 * 3. 在 ActivateAbility 调用结束之前发生的任何副作用，都会关联到这个生成的 FPredictionKey 上。
 * 4. 服务器在 ServerTryActivateAbility 中决定这个 ability 是否真的发生，
 *    然后调用 ClientActivateAbility(Failed/Succeed)，并把 UAbilitySystemComponent::ReplicatedPredictionKey
 *    设置为客户端请求中发送过来的那个生成 key。
 * 5. 如果客户端收到 ClientAbilityFailed，它会立即终止这个 ability，
 *    并回滚所有关联到该 PredictionKey 的副作用。
 *     5a. “回滚”逻辑通过 FPredictionKeyDelegates 以及
 *         FPredictionKey::NewRejectedDelegate / NewCaughtUpDelegate / NewRejectOrCaughtUpDelegate 注册。
 *     5b. ClientAbilityFailed 实际上是我们“拒绝” PredictionKey 的唯一场景。
 *         因此，我们当前所有预测都依赖 ability 是否成功激活。
 * 6. 如果 ServerTryActivateAbility 成功，客户端必须等待属性复制追上。
 *    Succeed RPC 会立即发送，而属性复制会按自身节奏发生。
 *    一旦 ReplicatedPredictionKey 追上前面步骤中使用的 key，客户端就可以撤销自己的预测性副作用。
 *    可以查看 FReplicatedPredictionKeyItem::OnRep 中的 CatchUpTo 逻辑。
 *    可以查看 UAbilitySystemComponent::ReplicatedPredictionKeyMap 来了解 key 实际如何复制。
 *    可以查看 ~FScopedPredictionWindow 来了解服务器如何确认 key。
 *
```
其实前面已经把预测的原理讲的差不多了. 这里主要就看GA激活的流程. GA激活基本上就是预测的起点.

GA激活的入口是TryActivateAbility. 这个函数内部做一点判断(主要判断是否允许你启用别人的GA), 没毛就直接转InternalTryActivateAbility.

InternalTryActivateAbility同样是先做一堆判断, 没毛就开始尝试激活Ability. 主要分为服务器和客户端这两个分支.

注意, 一旦进入服务器分支, 就代表服务器认为客户端此次预测是正确的. 如果不正确, 那么在前面一系列的判断中就会通过RPC来拒绝客户端的预测了. 

服务器分支行为如下:
![[Pasted image 20260520130148.png]]
![[Pasted image 20260520130633.png]]

客户端分支如下:
![[Pasted image 20260520131730.png]]
![[Pasted image 20260520132343.png]]
这里有个细节要注意, 服务器RPC的调用(第三步)必须在本地激活Ability(第五步)之前. 因为存在GA递归激活的情况. 

比如, 能力A会激活能力B. 如果RPC放在能力A激活之后, 那么服务器接收到的RPC的顺序就完全反过来: 创建预测窗口1, 本地激活能力A -> 创建预测窗口2, 本地激活能力B, 调用RPC通知服务器激活能力B -> 调用RPC通知服务器激活能力A.

而正常顺序是: 创建预测窗口1, 调用RPC通知服务器激活能力A, 本地激活能力A -> 创建预测窗口2, 调用RPC通知服务器激活能力B, 本地激活能力B.

这两个分支走完之后, 做一些最后的处理:
![[Pasted image 20260520140324.png]]
关于Spec的同步, 详见附录.

GA激活的流程基本就是这样.

# GameplayEffect 预测
```
 *
 * *** GameplayEffect Prediction ***
 *
 * GameplayEffect 被认为是 ability 激活的副作用，它们不会被单独接受或拒绝。
 *
 * 1. GameplayEffect 只有在客户端拥有有效 PredictionKey 时才会被应用。
 *    如果没有 PredictionKey，客户端会直接跳过应用。
 * 2. 如果 GameplayEffect 被预测，那么 Attributes、GameplayCues 和 GameplayTags 都会被预测。
 * 3. 创建 FActiveGameplayEffect 时，它会存储 PredictionKey，即 FActiveGameplayEffect::PredictionKey。
 *     3a. Instant effect 会在下面的 “Attribute Prediction” 中解释。
 * 4. 在服务器上，同一个 PredictionKey 也会设置到服务器的 FActiveGameplayEffect 上，
 *    之后这个效果会复制下来。
 * 5. 作为客户端，如果你收到一个复制下来的 FActiveGameplayEffect，并且它带有有效 PredictionKey，
 *    你会检查自己是否已经有一个带同样 key 的 ActiveGameplayEffect。
 *    如果匹配，就不会执行 “on applied” 类型的逻辑，例如 GameplayCue。
 *    这解决了 “Redo” 问题。
 *    不过，我们会暂时在 ActiveGameplayEffects 容器中拥有两个“相同”的 GameplayEffect。
 * 6. 同时，FReplicatedPredictionKeyItem::OnRep 会追上该 key，预测效果会被移除。
 *    当这种情况下移除预测效果时，我们会再次检查 PredictionKey，
 *    并决定是否不执行 “On Remove” 逻辑或 GameplayCue。
 *
 * 到这里，我们实际上已经把 GameplayEffect 作为一个副作用完成了预测，
 * 并处理了 “Undo” 和 “Redo” 问题。
 *
 * 查看 FActiveGameplayEffectsContainer::ApplyGameplayEffectSpec，
 * 其中注册了 caught-up 时要做什么，也就是 RemoveActiveGameplayEffect_NoReturn。
 * 查看 FActiveGameplayEffect::PostReplicatedAdd、FActiveGameplayEffect::PreReplicatedRemove
 * 以及 FActiveGameplayCue::PostReplicatedAdd，可以看到 FPredictionKey 如何与 GE 和 GC 关联。
 *
```
 
 实际上, ASC中有一个数组, 保存当前ASC上Activate的所有GE.
 ```cpp
/** Contains all of the gameplay effects that are currently active on this component */  
UPROPERTY(Replicated)  
FActiveGameplayEffectsContainer ActiveGameplayEffects;
 ```
整个GE的应用, 预测, 以及回滚等等的实现, 都围绕这个数组展开.

(下面这部分拆解看不明白没事, 后面有简单理解版, 已用分割线分割.)

---
GE应用的入口在ApplyGameplayEffectSpecToSelf, 接收两个参数: Spec和Key. 这个函数有点类似前面的InternalTryActivateAbility, 与GE Apply相关的接口函数基本都会转到这个函数中.

流程如下:

1. 上锁ActiveGameplayEffects数组(ASC中的一个数组, 保存当前ASC上Activate的所有GE)
2. 告诉 AbilitySystemGlobals：当前正在应用哪个 GameplayEffectSpec，以及应用到哪个 ASC. 在后面GE Apply的流程中, 如果有需要这份上下文的, 就可以通过 AbilitySystemGlobals 维护的 current applied GE 栈拿到上下文。
3. 仅允许服务器或拥有有效预测键的客户端继续执行.
4. 不允许预测periodic GE. 如果传进来的Spec中的GE是Periodic的, 并且传进来的预测键有效, 那么对于服务器会让预测键无效, 对于客户端则停止执行.
5. 查看是否有query阻止当前GE的apply. 比如"免疫火焰伤害"会阻止GE_FireDamage的Apply
6. 询问挂载在GE身上的GE Component是否允许此次apply.
7. 检查GE挂载的Modifier所涉及到的属性是否都有效. TODO: "Modifier涉及的属性是否有效"这个检查可以缓存在本地, 而不用每次Apply GE都遍历检查; 并且不止有Modifier所涉及到的属性需要检查, Execution涉及的属性也需要检查.
8. 对于预测的GE, 如果是Instant GE, 那么将其视为Infinite GE. (用变量bTreatAsInfiniteDuration标识).

至此, 只是完成了准备工作. 此时可以将GE分为五种类型: Periodic, Infinite, Duration, 预测Instant, 普通Instant. 

显然当bTreatAsInfiniteDuration=true的时候, 说明当前GE是预测Instant. 

那么什么时候会是普通Instant? 没有Key的客户端无法继续执行, 有Key的客户端会走预测Instant. 所以普通Instant的情况就是两种: 服务器直接执行普通Instant, 以及客户端预测Instant, 服务器普通Instant. 

应用GE的时候, 对于前四种GE类型, 会走ActiveGameplayEffects.ApplyGameplayEffectSpec, 对于普通Instant, 会走ActiveGameplayEffects.ExecuteActiveEffectsFrom. 

可以把它们理解成 GAS 里两条完全不同的 GE 处理路径：
```text
ApplyGameplayEffectSpec
    = 把 GE 变成一个“持续存在的 ActiveGE 状态”。

ExecuteActiveEffectsFrom
    = 立刻执行一次 GE 的效果。
```
目前只需要简单认为: 前者是给非Instant用的, 后者是给Instant用的. 以及Periodic的每次实际触发, 也是使用后者. 这俩函数的具体实现非常复杂, 所以我们还是先聚焦于GAS预测这块吧0.0

然后GAS将客户端预测的Instant给伪装成了Infinite, 所以也走ApplyGameplayEffectSpec.
![[Pasted image 20260521174511.png]]
"回滚"的相关实现就放在这个函数中:
![[Pasted image 20260521174754.png]]
这里为预测键绑定回调. 
![[Pasted image 20260521175201.png]]
调用接口函数Remove, 移除GE.

所以这就顺下来了: 应用GE->绑定回调->Key同步到客户端时移除GE.

---

为什么一开始说都是围绕ActiveGameplayEffects数组展开的? 因为这些函数的一大部分操作, 都是在管理ActiveGameplayEffects数组以及修改其中的元素. 

(ActiveGameplayEffects数组是个FastArray, 其中的元素是FastArray Item, 意味着他们能够定义自己的回调函数, 比如PostAdd, PostChanged.)

以前面讲的客户端预测GE来说, 你可以简单理解为: 

1. 客户端往本地的ActiveGameplayEffects数组添加一个预测GE
2. 服务器往权威的ActiveGameplayEffects数组添加一个权威GE
3. 之后ActiveGameplayEffects数组同步到客户端(实际上服务器是MakeItemDirty, 所以是将新增的权威GE元素同步到客户端). 
4. 此时, 客户端的ActiveGameplayEffects数组同时存在预测GE和权威GE.
5. 等预测键也同步到客户端, 触发CaughtUp委托, 清楚预测的GE.

当然, 对于客户端预测的InstantGE, 服务器上执行InstantGE并不会往数组中添加权威GE, 而是直接修改对应属性值等等. 客户端只需要负责移除本地预测的InstantGE即可.

可以很清楚的看出, 有一段时间, 预测GE和权威GE同时存在于客户端的ActiveGameplayEffects数组. 所以可能导致数值跳变, 视觉效果跳变等等奇怪的表现. GAS的解决办法是, 在权威GE同步到客户端的时候, 触发该GE的回调函数(类似前面预测键的PostAdd等回调函数), 在这个回调函数中判断客户端本地的预测键是否有效, 如果有效说明自己是预测这个GE的客户端, 无需播放GameplayCue效果.
![[Pasted image 20260521180535.png]]

至此, 再回看一下前面的注释, 应该基本都能理解.

# Attribute 预测
```
 * *** Attribute Prediction ***
 *
 * 由于属性是作为标准 UPROPERTY 复制的，所以预测它们的修改会比较棘手，这就是 “Override” 问题。
 * 瞬时修改更难，因为它们本质上不是有状态的。
 * 例如，如果修改之后没有保存任何记录，那么回滚一个属性 modifier 会很困难。
 * 这也让 “Undo” 和 “Redo” 问题在这种情况下变得更难。
 *
 * 基本方案是把属性预测当作 delta 预测，而不是绝对值预测。
 * 我们不会预测“我有 90 点 mana”，而是预测“基于服务器值，我有 -10 mana 的变化”，
 * 直到服务器确认我们的 PredictionKey。
 * 基本上，当属性修改以预测方式发生时，我们把 instant modification 当作对属性的“无限时长 modification”。
 * 这解决了 “Undo” 和 “Redo”。
 *
 * 对于 “Override” 问题，我们可以在属性的 OnRep 中处理：
 * 把复制下来的服务器值当作属性的 base value，而不是 final value，
 * 然后在复制发生后重新聚合出我们的 final value。
 *
 *
 * 1. 我们把预测性的 instant GameplayEffect 当作无限时长 GameplayEffect。
 *    见 UAbilitySystemComponent::ApplyGameplayEffectSpecToSelf。
 * 2. 我们必须总是接收属性上的 RepNotify 调用。
 *    不只是本地上一次值发生变化时才接收，因为我们会提前预测变化。
 *    这通过 REPNOTIFY_Always 完成。
 * 3. 在属性的 RepNotify 中，我们调用 AbilitySystemComponent::ActiveGameplayEffects，
 *    根据新的 base value 更新我们的 final value。
 *    GAMEPLAYATTRIBUTE_REPNOTIFY 可以完成这件事。
 * 4. 其他所有内容会像上面的 GameplayEffect 预测一样工作：
 *    当 PredictionKey caught up 时，预测性的 GameplayEffect 会被移除，
 *    我们会回到服务器给出的值。
 *
 *
 * 示例：
 *
 * void UMyHealthSet::GetLifetimeReplicatedProps(TArray< FLifetimeProperty > & OutLifetimeProps) const
 * {
 *     Super::GetLifetimeReplicatedProps(OutLifetimeProps);
 *
 *     DOREPLIFETIME_CONDITION_NOTIFY(UMyHealthSet, Health, COND_None, REPNOTIFY_Always);
 * }
 *
 * void UMyHealthSet::OnRep_Health()
 * {
 *     GAMEPLAYATTRIBUTE_REPNOTIFY(UMyHealthSet, Health);
 * }
 *
```
Attribute预测其实就是前面GameplayEffect预测的延申. GE本身就附带修改Attribute的效果.

关于Attribute的计算也属于GAS的基础内容了. 这里小小复习一下:

对于一个Attribute当前值的计算, 可以理解为是多个Modifier叠加后, 通过Aggregator算出来的. 

一个Modifier影响下面的计算的各个系数:
```cpp
CurrentValue = ((BaseValue + AddBase) * MultiplyAdditive / DivideAdditive * MultiplyCompound) + AddFinal
```
另外有一个Channel的概念. 每个Channel都会计算出自己的CurrentValue, 并将其作为下一个Channel的BaseValue.

一般来说, 默认只用一个Channel. 在同一个Channel下的多个Modifier, 他们的系数将会一次性求和. 然后再代入公式计算.
```cpp
float FAggregatorModChannel::EvaluateWithBase(float InlineBaseValue, const FAggregatorEvaluateParameters& Parameters) const
{
    for (const FAggregatorMod& Mod : Mods[EGameplayModOp::Override])
    {
        if (Mod.Qualifies())
        {
            return Mod.EvaluatedMagnitude;
        }
    }

    float Additive = SumMods(Mods[EGameplayModOp::Additive], ...);
    float Multiplicitive = SumMods(Mods[EGameplayModOp::Multiplicitive], ...);
    float Division = SumMods(Mods[EGameplayModOp::Division], ...);
    float FinalAdd = SumMods(Mods[EGameplayModOp::AddFinal], ...);
    float CompoundMultiply = MultiplyMods(Mods[EGameplayModOp::MultiplyCompound]);

    return ((InlineBaseValue + Additive) * Multiplicitive / Division * CompoundMultiply) + FinalAdd;
}
```

Attribute的预测, 就可以认为是客户端本地预测生成一个Modifier. 等到回滚的时候再把预测的Modifier拿掉.

这个Modifier实际上在GE Apply的时候就被创建, 调用链:
```
ApplyGameplayEffectSpec
-> InternalOnActiveGameplayEffectAdded
-> Owner->SetActiveGameplayEffectInhibit(EffectHandle, !bActive, bInvokeGameplayCueEvents)
-> 如果 !bActive == false，也就是 GE 处于 active
-> AddActiveGameplayEffectGrantedTagsAndModifiers
```

另一个需要知道的是: Attribute本身会做属性同步. 同步的时候会把BaseValue和CurrentValue都同步下来.

实际上, 一个Attribute预测流程大致如下:

对于非InstantGE:
1. 客户端预测GE, 生成预测Modifier, Aggregator根据本地的Modifier以及BaseValue, 计算出预测的CurrentValue.
2. 服务器应用权威GE, 生成权威Modifier, 计算出权威CurrentValue.
3. 权威GE同步到客户端, 触发该GE的PostAdd回调函数, 回调函数内会从这个GE生成权威Modifier(走是上面提到的Owner->SetActiveGameplayEffectInhibit路径), 通过Aggregator计算出新的CurrentValue.
4. 服务器的Attribute通过属性同步, 同步到客户端. 客户端拿到同步过来的Attribute的BaseValue, 通过Aggregator重新算一次CurrentValue.
5. 预测键同步到客户端, 触发CaughtUp回调, 移除预测GE, 也附带移除了预测Modifier, 通过Aggregator重新算一次CurrentValue.

其中3, 4, 5顺序不一定. 但不影响结果.

对于InstantGE:
1. 客户端预测InstantGE, 生成预测Modifier, Aggregator根据本地的Modifier以及BaseValue, 计算出预测的CurrentValue.
2. 服务器根据InstantGE, 直接修改Attribute的BaseValue.
3. 服务器的Attribute通过属性同步, 同步到客户端. 客户端拿到同步过来的Attribute的BaseValue, 通过Aggregator重新算一次CurrentValue.
4. 预测键同步到客户端, 触发CaughtUp回调, 移除预测GE, 也附带移除了预测Modifier, 通过Aggregator重新算一次CurrentValue.

其中3, 4顺序不一定, 但不影响结果.

你可以发现, 客户端有生成Modifier, 但是服务器是直接修改BaseValue的. 所以实际上这块是客户端通过Modifier模拟服务器直接修改BaseValue的效果.

# GameplayCue 预测
```
 * *** Gameplay Cue Events ***
 *
 * 除了前面已经解释过的 GameplayEffect 内部的 GameplayCue 之外，
 * GameplayCue 也可以独立激活。
 * 这些函数，例如 UAbilitySystemComponent::ExecuteGameplayCue，会考虑网络角色和 PredictionKey。
 *
 * 1. 在 UAbilitySystemComponent::ExecuteGameplayCue 中，如果是 authority，
 *    就执行 multicast event，并带上 replication key。
 *    如果不是 authority，但拥有有效 PredictionKey，就预测 GameplayCue。
 * 2. 在接收端，例如 NetMulticast_InvokeGameplayCueExecuted，
 *    如果存在 replication key，就不执行该事件，假设你已经预测过它了。
 *
 * 记住，FPredictionKey 只会复制给最初发起预测的 owner。
 * 这是 FReplicationKey 的一个内在属性。
 *
```
其实在GE预测那块就提到过了. 

客户端激活Ability, 执行预测代码, 其中也包括预测GameplayCue的播放. 

服务器执行权威代码的时候, 广播GameplayCue的时候也会带上预测键. 对于拥有有效预测键的客户端, 就无需再次播放这个GameplayCue.

# 其他
下面是剩下的注释, 就是一些细节问题. 有一部分前面讲过, 没讲过的应该也能大概get到意思. 就不再展开.
```
 * ---------------------------------------------------------
 *
 * 高级主题！
 *
 * *** Dependencies ***
 *
 * 我们可能会遇到这样的情况：
 * “Ability X 激活，并立刻触发一个事件，激活 Ability Y，然后 Y 又触发 Ability Z”。
 * 依赖链就是 X -> Y -> Z。
 * 这些 ability 中的每一个都可能被服务器拒绝。
 * 如果 Y 被拒绝，那么 Z 实际上也从未发生过。
 * 但服务器从来没有尝试运行 Z，因此服务器不会显式决定“Z 不能运行”。
 *
 * 为了处理这个问题，我们引入了 Base PredictionKey 的概念，它是 FPredictionKey 的成员。
 * 调用 TryActivateAbility 时，我们会传入当前的 PredictionKey，如果有的话。
 * 这个 PredictionKey 会作为新生成 PredictionKey 的 base。
 * 我们通过这种方式构建 key 链，这样如果 Y 被拒绝，就可以让 Z 失效。
 *
 * 不过这里稍微更复杂一点。
 * 在 X -> Y -> Z 的场景中，服务器在尝试自己运行这条链之前，只会收到 X 的 PredictionKey。
 * 例如，服务器会使用客户端发送过来的原始 PredictionKey 来 TryActivate Y 和 Z。
 * 而客户端每次调用 TryActivateAbility 时，都会生成一个新的 PredictionKey。
 * 客户端必须为每次 ability 激活生成新的 PredictionKey，因为每次激活在逻辑上并不是原子的。
 * 事件链中产生的每个副作用都必须拥有唯一的 PredictionKey。
 * 我们不能让 X 中产生的 GameplayEffect 和 Z 中产生的 GameplayEffect 使用同一个 PredictionKey。
 *
 * 为了解决这个问题，X 的 PredictionKey 会被视为 Y 和 Z 的 Base key。
 * 从 Y 到 Z 的依赖关系完全保存在客户端侧。
 * 这是通过 FPredictionKeyDelegates::AddDependancy 完成的。
 * 我们添加 delegate，使得如果 Y 被拒绝或确认，Z 也会被拒绝或 caught up。
 *
 * 这个依赖系统允许我们在单个预测窗口或 scope 中拥有多个并非逻辑原子的预测动作。
 *
 * 不过这里有一个问题：
 * 因为依赖关系保存在客户端侧，所以服务器实际上并不知道自己之前是否拒绝过某个依赖动作。
 * 你可以在 gameplay abilities 中使用 activation tags 来绕开这个问题。
 * 例如，在预测依赖 GA_Combo1 -> GA_Combo2 时，
 * 可以让 GA_Combo2 只有在拥有 GA_Combo1 给予的 GameplayTag 时才能激活。
 * 这样，如果 GA_Combo1 被拒绝，服务器也会拒绝 GA_Combo2 的激活。
 *
 *
 * *** Additional Prediction Windows (within an Ability) ***
 *
 * 如前所述，一个 PredictionKey 只在单个逻辑 scope 中可用。
 * 一旦 ActivateAbility 返回，我们基本上就用完了这个 key。
 * 如果 ability 正在等待外部事件或 timer，那么当我们准备继续执行时，
 * 很可能已经从服务器收到 confirm 或 reject 了。
 * 因此，初始激活之后产生的任何额外副作用，都不能再绑定到原始 key 的生命周期上。
 *
 * 这并不算太糟，问题在于 ability 有时需要响应玩家输入。
 * 例如，一个“按住蓄力”的 ability 希望在按钮释放时立刻预测一些东西。
 * 这时可以用 FScopedPredictionWindow 在 ability 内创建一个新的预测窗口。
 *
 * FScopedPredictionWindow 提供了一种方式：
 * 向服务器发送一个新的 PredictionKey，并让服务器在同一个逻辑 scope 中接收并使用这个 key。
 *
 * UAbilityTask_WaitInputRelease::OnReleaseCallback 是一个很好的例子。
 * 事件流程如下：
 * 1. 客户端进入 UAbilityTask_WaitInputRelease::OnReleaseCallback，并开启一个新的 FScopedPredictionWindow。
 *    这会为这个 scope 创建一个新的 PredictionKey，即 FScopedPredictionWindow::ScopedPredictionKey。
 * 2. 客户端调用 AbilitySystemComponent->ServerInputRelease，
 *    并把 ScopedPrediction.ScopedPredictionKey 作为参数传过去。
 * 3. 服务器运行 ServerInputRelease_Implementation，
 *    接收传入的 PredictionKey，并通过 FScopedPredictionWindow 把它设置为 UAbilitySystemComponent::ScopedPredictionKey。
 * 4. 服务器在同一个 scope 内运行 UAbilityTask_WaitInputRelease::OnReleaseCallback。
 * 5. 当服务器在 ::OnReleaseCallback 中遇到 FScopedPredictionWindow 时，
 *    它会从 UAbilitySystemComponent::ScopedPredictionKey 中取得 PredictionKey。
 *    这个 key 现在会用于这个逻辑 scope 中的所有副作用。
 * 6. 一旦服务器结束这个 scoped prediction window，所使用的 PredictionKey 就完成了，
 *    并被设置到 ReplicatedPredictionKey。
 * 7. 在这个 scope 中创建的所有副作用，现在都在客户端和服务器之间共享同一个 key。
 *
 * 这套机制能工作的关键在于：
 * ::OnReleaseCallback 调用 ::ServerInputRelease，
 * 而 ::ServerInputRelease 会在服务器上调用 ::OnReleaseCallback。
 * 中间没有空间让其他事情发生并使用这个给定的 PredictionKey。
 *
 * 虽然这个例子中没有 “Try/Failed/Succeed” 调用，
 * 但所有副作用都被程序性地分组为原子操作。
 * 这为任何同时在服务器和客户端运行的任意函数调用，解决了 “Undo” 和 “Redo” 问题。
 *
 *
 * ---------------------------------------------------------
 *
 * 不支持的内容 / 问题 / 待办
 *
 * Triggered events 不会显式复制。
 * 例如，如果某个 triggered event 只在服务器上运行，客户端永远不会听说它。
 * 这也阻止我们实现跨玩家、AI 等事件。
 * 未来应该添加对此的支持，并让它遵循和 GameplayEffect、GameplayCue 相同的模式：
 * 使用 PredictionKey 预测 triggered event；
 * 如果 RPC event 带有 PredictionKey，就忽略它。
 *
 * 这个系统有一个很大的注意事项：
 * 任何链式激活，包括 triggered events，目前都无法开箱即用地回滚。
 * 原因是每个 ServerTryActivateAbility 都会按顺序得到响应。
 *
 * 以依赖式 GA 链为例：GA_Mispredict -> GA_Predict1。
 * 在这个例子中，当 GA_Mispredict 被激活并在本地预测时，
 * 它会立即同时激活 GA_Predict1。
 * 客户端为 GA_Mispredict 发送 ServerTryActivateAbility，
 * 服务器拒绝它，并返回 ClientActivateAbilityFailed。
 * 按当前情况，我们没有任何 delegate 会在客户端拒绝依赖 ability，
 * 而且服务器甚至不知道存在这些依赖。
 * 在服务器上，它也会收到 GA_Predict1 的 ServerTryActivateAbility。
 * 假设它成功了，那么客户端和服务器现在都会执行 GA_Predict1，
 * 尽管 GA_Mispredict 从未真正发生过。
 * 你可以通过 tag 系统来绕开这个问题，确保 GA_Mispredict 已经成功。
 *
 * *** 预测 “Meta” 属性，例如 Damage/Healing，与预测 “真实” 属性，例如 Health ***
 *
 * 我们无法以预测方式应用 meta attributes。
 * Meta attributes 只对 instant effects 生效，并且是在 GameplayEffect 后端工作，
 * 也就是 UAttributeSet 上的 Pre/Post Modify Attribute。
 * 当应用 duration-based GameplayEffect 时，这些事件不会被调用。
 * 例如，一个持续 5 秒修改 damage 的 GameplayEffect 本身就不太合理。
 *
 * 为了支持这一点，我们可能需要为 duration-based meta attributes 添加一些有限支持，
 * 并把 instant GameplayEffect 的转换逻辑从前端，
 * 即 UAbilitySystemComponent::ApplyGameplayEffectSpecToSelf，
 * 移到后端，即 UAttributeSet::PostModifyAttribute。
 *
 *
 * *** 预测持续中的乘法 GameplayEffects ***
 *
 * 在预测百分比类 GameplayEffect 时也有限制。
 * 因为服务器复制下来的是属性的 final value，
 * 而不是完整的、描述有哪些东西正在修改该属性的 aggregator chain。
 * 因此我们可能会遇到客户端无法准确预测新 GameplayEffect 的情况。
 *
 * 例如：
 * - 客户端拥有一个永久 +10% 移速 buff，基础移速是 500，
 *   所以该客户端的最终移速是 550。
 * - 客户端有一个 ability，会额外给予 10% 移速 buff。
 *   预期行为是把这些百分比 multiplier 相加，得到总共 20% bonus，
 *   也就是从 500 变成 600。
 * - 然而在客户端上，我们只是把 10% buff 应用到 550 上，
 *   得到 605。
 *
 * 这需要通过复制属性的 aggregator chain 来修复。
 * 我们已经复制了其中一些数据，但不是完整的 modifier 列表。
 * 之后需要研究如何支持这一点。
 *
 *
 * *** “Weak Prediction” ***
 *
 * 可能仍然会有一些情况并不适合这个系统。
 * 有些场景中，PredictionKey 交换并不可行。
 * 例如，一个 ability 会让玩家碰撞或接触到的任何对象都受到一个 GameplayEffect，
 * 使它们减速并把材质变蓝。
 * 因为我们不可能每次发生这种事情都发送 Server RPC，
 * 而且服务器在自己的模拟时刻也不一定能处理该消息，
 * 所以没有办法在客户端和服务器之间关联这些 GameplayEffect 副作用。
 *
 * 一种方案是考虑一种更弱形式的预测。
 * 在这种模式中，不使用新的 PredictionKey，
 * 而是服务器假设客户端会预测整个 ability 的所有副作用。
 * 这至少能解决 “redo” 问题，但不能解决 “completeness” 问题。
 * 如果客户端侧预测可以尽量保持最小化，
 * 例如只预测初始粒子效果，而不是预测状态和属性变化，
 * 那么问题会没那么严重。
 *
 * 我可以想象一种 weak prediction 模式：
 * 当没有新的 PredictionKey 能够准确关联副作用时，
 * 某些 ability，或者所有 ability，会回退到这种模式。
 * 在 weak prediction 模式下，也许只有某些动作可以预测，
 * 例如 GameplayCue execute events，
 * 但不预测 OnAdded / OnRemove events。
 *
 *
 */
```

# 附录1: AbilitySpec和GA实例的同步机制

对于Spec, 可以简单认为其存储了Ability的上下文信息. 比如这个Ability的类, 等级, 输入绑定等等.

ASC中, 会存储所有可激活的Ability的Spec.
![[Pasted image 20260520143608.png]]
和前面提到过的FReplicatedPredictionKeyMap类似, 这个FGameplayAbilitySpecContainer也是一个FastArray, 其中的每个Item则是Spec.
```cpp
struct FGameplayAbilitySpecContainer : public FFastArraySerializer  
{  
	...
    /** List of activatable abilities */  
    UPROPERTY()  
    TArray<FGameplayAbilitySpec> Items;  
  
    /** Component that owns this list */  
    UPROPERTY(NotReplicated)  
    TObjectPtr<UAbilitySystemComponent> Owner;  
    ...
};
```
Spec内部则定义了三个回调函数:
```cpp
UE_API void PreReplicatedRemove(const struct FGameplayAbilitySpecContainer& InArraySerializer);  
UE_API void PostReplicatedChange(const struct FGameplayAbilitySpecContainer& InArraySerializer);  
UE_API void PostReplicatedAdd(const struct FGameplayAbilitySpecContainer& InArraySerializer);
```
在服务器赋予ASC一个Ability的时候, 将Spec标脏, 注意第二个参数设置为true.
![[Pasted image 20260520150320.png]]
等这个Spec同步到客户端之后触发PostAdd回调.
![[Pasted image 20260520152705.png]]
这里有个比较复杂的操作: AddReplicatedInstancedAbility. 并且还用了一个控制台变量CVarRecordAbilityInstancesOnClientSpecUpdates做判断. 这里做一下讲解:
![[Pasted image 20260520160143.png]]
1. ASC维护一个AllReplicatedInstancedAbilities数组. 记录了需要被同步的Ability实例. AddReplicatedInstancedAbility就是往这个数组中新增实例.
2. UE 网络复制的主角通常是 `AActor`。Actor 有自己的 ActorChannel。但是很多对象不是 Actor, 这些 UObject 自己没有独立 ActorChannel。它们如果想复制，通常要挂在某个 Actor 或 Component 下面，通过 Actor 的网络通道一起复制。这样的 UObject 就叫 replicated subobject。`UGameplayAbility` 实例不是 Actor，它想同步自己的 replicated 属性，就需要作为 ASC 的 subobject 复制出去。也就是这里的AddReplicatedSubObject. ![[Pasted image 20260520160242.png]]所以核心其实是这里的SubObject. 调用了这个函数之后, 这个GA就会在Actor同步到客户端的时候一起被同步过去.
3. 有一点需要区分: Spec中有一个字段ReplicatedInstances, 也存储了要同步的Ability实例. ASC中维护的是整个ASC中要同步的Ability实例, Spec中维护的只是当前Spec要同步的Ability实例.  实际上, 在维护AllReplicatedInstancedAbilities数组的时候, 往往也会使用Spec中的这个ReplicatedInstances字段. 比如当服务器创建一个需要同步的Ability实例时:![[Pasted image 20260520161343.png]]
4. 控制台变量CVarRecordAbilityInstancesOnClientSpecUpdates就是专门控制当Spec同步的时候, 要不要根据Spec的ReplicatedInstances字段维护AllReplicatedInstancedAbilities数组. 使用这个CVar是因为这里涉及两个复制系统交叉: `FGameplayAbilitySpec` 是 FastArray 复制, 而`UGameplayAbility` instance 是 subobject 复制. 这两个东西的到达顺序、创建时机、引用解析，历史上都比较容易出边角问题。Epic 给了一个 CVar，万一项目里这套自动登记逻辑引发问题，可以关掉。
5. 虽然AddReplicatedInstancedAbility是和网络同步相关的, 不过在PostAdd函数以及其他Spec的回调函数中调用AddReplicatedInstancedAbility的往往是客户端. 此时可以认为只是客户端在维护ASC中的这个数组. (这个数组不是Rep变量)

这块看懂之后, 剩下的就比较容易了. Add回调会让客户端也触发一次OnGiveAbility.
Remove回调则触发OnRemoveAbility
![[Pasted image 20260520162506.png]]
Change回调啥都不做, 就维护一下数组.
![[Pasted image 20260520162545.png]]

最后来看看Spec标脏:
![[Pasted image 20260520143218.png]]
1. 一般来说, 会在修改了Spec中相关内容, 以及新增或移除Spec的时候, 调用这个函数.
2. 第二个参数默认是false. 只有新增或移除Spec的时候会以true作为参数调用这个函数.
3. 对于服务器, 除了同时满足"第二个参数为false, 并且当前Ability的同步策略是ServerOnly"的情况以外, 都会标脏Spec, 让Spec同步到客户端, 并触发对应回调(Add, Remove, 或者Change). 最后会广播一个委托. 不过这个委托我没找到有哪里用上. 
4. 对于客户端, 只标脏Array. 这是因为客户端做的是预测, 所以告诉FastArray这个数组内部有变化, 需要在下一次服务器标脏Item, 将Item同步过来的时候重建索引. 这块涉及到FastArray内部同步的实现了, 这里就不展开说. 

