---
date: 2026-05-26
---
主要参考[UE5 GAS - 以Lyra为例 - 知乎](https://zhuanlan.zhihu.com/p/1934717850632823338)

AbilityActorInfo相关. (InitAbilityActorInfo, 以及该结构体的相关字段)

ASC挂载在PlayerState的时候, NetFrequency需要提升为100. 因为PS本身的NetFrequency是1, 而ASC需要高频的同步.

Spec是上下文信息, SpecHandle则是Spec的ID, 会存储指向Spec的指针.

GiveAbility赋予GA. 主要操作是将GASpec加入AvaliableAbility数组, 触发自己的OnGiveAbility, 标脏Spec. 等Spec同步到客户端之后也会调用客户端的OnGiveAbility.

GA实例化有两种方式(NonInstanced已在5.5被废弃)
- InstancedPerActor(默认. 实际上叫做InstancedPerSpec更合适). 
- InstancedPerExecution. 这种方式的GA

GA实例与Spec的同步机制(详见[GAS预测](https://www.zhihu.com/people/nanoshiki/posts)的附录)

AttributeSet的两种用法: 创建一个巨大的AttributeSet, 然后按需使用其中的属性; 或者将各个属性模块化, 需要的时候就引入对应的AttributeSet.

Lyra中AttributeSet在PlayerState中作为成员, 并在构造函数中通过CreateDefaultSubobject创建. 之后ASC会通过反射拿到Owner(即PlayerState)以及ChildObject(即PlayerState构造函数中创建的Subobject)
```cpp
void UAbilitySystemComponent::InitializeComponent()
{
    //...
    TArray<UObject*> ChildObjects;
    GetObjectsWithOuter(Owner, ChildObjects, false, RF_NoFlags, EInternalObjectFlags::Garbage);
    for (UObject* Obj : ChildObjects)
    {
        UAttributeSet* Set = Cast<UAttributeSet>(Obj);
        if (Set)  
        {
            SpawnedAttributes.AddUnique(Set);
        }
    }
    SetSpawnedAttributesListDirty();
}
```
这个AttributeSet也需要加入ReplicatedSubObject列表.
```cpp
void UAbilitySystemComponent::ReadyForReplication()
{
    Super::ReadyForReplication();
    // Register the spawned attributes to the replicated sub object list.
    if (IsUsingRegisteredSubObjectList())
    {
        //把GA Instance加入SubObject列表
        for (UGameplayAbility* ReplicatedAbility : GetReplicatedInstancedAbilities_Mutable())
        {
            if (ReplicatedAbility)
            {
                const ELifetimeCondition LifetimeCondition = bReplicateAbilitiesToSimulatedProxies ? COND_None : COND_ReplayOrOwner;
                AddReplicatedSubObject(ReplicatedAbility, LifetimeCondition);
            }
        }
        //把Attribute Object加入列表
        for (UAttributeSet* ReplicatedAttribute : SpawnedAttributes)
        {
            if (ReplicatedAttribute)
            {
                AddReplicatedSubObject(ReplicatedAttribute);
            }
        }
    }
}
```


如何判断一个Ability是Active的? Spec中有个计数器字段, 当Ability被Active的时候就+1, End的时候就-1.

Ability激活流程:

- TryActivateAbility, 做一大堆检查, 预测以及服务器RPC等等在这个函数中执行.
- CanActivateAbility, 业务检查. 比如是否有Tag互斥. 这块可以自己重写.
- PreActivate, 递增Spec的计数器, 刷新ActorInfo信息等等.
- ActivateAbility, cpp的实现是调用蓝图的K2_ActivateAbility.
- CommitAbility, 让CostGE, Cooldown等生效.(ApplyCooldown, ApplyCost)  (CommitAbility只由服务器执行)

EndAbility流程:

做彻底的清理操作，在此之后这个GA会被其他GA Spec复用。自定义的GA可override

- 执行K2_OnEndAbility，通知蓝图，这个例子蓝图会调用RemoveWidget
- 执行OnGameplayAbilityEnded和OnGameplayAbilityEndedWithData回调
- 清理GA里创建的Task，它们都是Object，还要手动标记为Garbage，这里是UAbilityTask_StartAbilityState和UAbilityTask_WaitInputRelease
- 取消对其他GA的block，后续其他GA可被激活，主要是Tag互斥的处理，这个后面再展开
- 执行AbilityEndedCallbacks和OnAbilityEnded回调
- 更新Spec.ActiveCount计数器，减一

Cooldown GE的生效过程核心为CommitExecute时把一个Tag添加到ASC上，之后CheckCooldown直接判断当前有没有这个Tag，有则无法激活GA。持续时长通过注册一个Timer实现，Timer到后去掉Tag即可。

CancelAbility最终也会调用EndAbility.

Lyra冲刺的实现: 客户端本地计算出要使用的Montage以及方向, 然后通过RPC发送这两个信息. 然后和服务器一块做PlayMontageAndWait, ApplyRootMotionForce等等. 然后由服务器生成GameplayCue.

冲刺打断换弹的实现: 通过TagRelationshipMapping实现.

GAS自带的Cost一般用于处理AttributeSet中的属性, 但是像子弹, 物品等等不一定在AttributeSet中的东西, Lyra引入额外的AddtionalCost. 跟GAS自带的Cost差不多, 提供ApplyCost函数, 然后LyraGA本身再定义一个AdditionalCost数组. (原本GAS的GA就有Cost数组, 这里思路类似). 然后ApplyCost的时候, 不止是调用Supre::ApplyCost, 也调用这个AdditionalCost数组中的元素的ApplyCost.

Cooldown也类似这个思路, Tag + Cooldown长度.

这样的话, 可以自己定义自己的Cost. 比如Lyra定义了一个用于物品的AdditionalCost. 其主要定义了物品Tag, 以及当前Cost的数值. Cost数值是个ScalableFloat,  Apply的时候可以拿到等级, 用到这个Cost数值上, 可以实现一级技能扣1, 二级技能扣2的效果.

开火GA实现: 本地往相机焦点做trace, hitResult发给服务器, 服务器完全信任, 添加GC并应用GE.

GESpec:

- Def，GE资源的CDO
- StackCount，堆叠数，这个可以调用时手动指定
- Duration，持续时间，能对GE资源中的Duration做调整
- Modifiers，Modifier的Spec

GE持续时间类型有三种：Instant, Infinite, HasDuration。Instant时最简单的，一次性立即生效，比如攻击扣血。而对于后两者一段时间内生效的GE，都需要创建一个FActiveGameplayEffect实例，并记录在ASC的ActiveGameplayEffects数组上进行管理，并同步到客户端。

```cpp
/** Contains all of the gameplay effects that are currently active on this component */
UPROPERTY(Replicated)
FActiveGameplayEffectsContainer ActiveGameplayEffects;
```

成员有

- Handle，生成的一个递增ID，用于外部索引这个实例
- Spec，关联的GE Spec
- StartServerWorldTime，GE开始时的Server时间戳
- DurationHandle，结束GE的TimerHandle

对于Colldown GE，会这样创建一个Timer，Timer结束时调用UAbilitySystemComponent::CheckDurationExpired函数做清理.

Execution:

先看下蓝图
![[Pasted image 20260526134308.png]]
再看实际Lyra实现的HealExecution. (DamageExecution太长)
![[Pasted image 20260526134726.png]]
![[Pasted image 20260526134848.png]]

当GE内同时存在多个Modifier, 以及多个Execution的时候. Modifier们会通过聚合的方式计算, 而Execution则是逐个逐个计算.

SetByCaller:
```cpp
/** Map of set by caller magnitudes */  
TMap<FName, float>        SetByCallerNameMagnitudes;  
TMap<FGameplayTag, float>   SetByCallerTagMagnitudes;
```
存在于GESpec中的Map. 每个Tag都能有自己的值. 可据此完成属性值的传递(属性本身有Tag).

MMC:
MMC就是自己通过运算得到一个值, 用这个MMC的值来做Op(依旧是Add, Mult这类操作), 而不是单纯地跟别的op一样是读表或者Setbycaller或者AttributeBase.

MMC和Execution的区别就是, MMC依旧会被纳入聚合计算中, 没有Execution那样强大. 

而由于GAS对于Attribute的预测是基于Modifier的, 预测错了回滚的时候可以直接拿掉对应的Modifier, 所以MMC可预测, Execution无法预测. 因为Execution并不单纯局限于影响数值, 他可以做的事情太多了, MMC则是单纯返回一个数值.

GameplayCue:

有两种GCNotify，并且引擎内置了一些子类

- UGameplayCueNotify_Static: 生效时不会实例化，Object或者Actor，用于实现一次性的瞬时效果
- AGameplayCueNotify_Actor: 生效时实例化一个Actor，Actor可以有Tick逻/辑，用于实现复杂一些的效果。GCNL_Dash就是这类。

GameplayCureManager:

有个单例Manager用于管理GC的生成，称为GameplayCureManager，基类是**UDataAsset**。Lyra有继承的自定义实现类ULyraGameplayCueManager。

Manager有如下几个功能

- 预加载GCN资源. config文件可配置GC的目录，字段为GameplayCueNotifyPaths
- 维护GCN_Actor缓冲池: GCN_Actor在被Remove后，会调用到UGameplayCueManager::NotifyGameplayCueActorFinished函数，归还给GCManager。Actor会先调用Recycle函数，清理自身属性，把Actor隐藏，然后加入到GCManager的PreAllocatedList容器中，留作以后使用。

GE中也可以配置GC Tag, 当GE应用时就会触发对应的GCN.

