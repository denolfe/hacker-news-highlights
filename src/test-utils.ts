import type { StoryOutput } from '@/types.js'

import * as cache from '@/utils/cache.js'
import { vi } from 'vitest'

export const jsonResponse = (data: Record<string, unknown>) =>
  Promise.resolve({
    headers: new Headers({ 'content-type': 'application/json' }),
    ok: true,
    json: () => Promise.resolve(data),
  })

export const textResponse = (text: string) =>
  Promise.resolve({
    headers: new Headers({ 'content-type': 'application/text' }),
    ok: true,
    text: () => Promise.resolve(text),
  })

export const disableCache = () => {
  vi.spyOn(cache, 'readFromCache').mockResolvedValue(null)
  vi.spyOn(cache, 'writeToCache').mockResolvedValue()
}

export const disableCacheRead = () => {
  vi.spyOn(cache, 'readFromCache').mockResolvedValue(null)
}

export const getRealStoryData = (): StoryOutput[] => [
  // @ts-expect-error no comments needed
  {
    content:
      "\n            As Richard Feynman points out, every 'why' question in science needs to be treated with caution. This is because there are always several different levels at which a why problem can be answered, depending on what kind of response you're looking for. Taking Feynman's illustrative example, if pizza arrives at your door and your partner asks why pizza has come, you could fully answer the question in any of the following ways:Because I was hungry so I ordered pizza.Because someone drove the pizza here from the pizza shop.Because in a capitalistic society, you can exchange money for pizza.Because I have UberEats on my phone, so I can order food whenever I'm hungry.And so on and so forth. The same goes for why questions in biology - we can go pretty deep if we try hard enough. So like any good 5 year old, in this article I'll do just that and keep asking why until we get somewhere interesting.Table of ContentsBee stingers are fishhooksA biological poison pumpSuper-organisms, the immune system and colonial lifeGroup selectionKin selection and biological altruismIndirect fitness and the haplodiploidy hypothesisThe haplodiploidy hypothesis isn't perfectConclusionBee stingers are fishhooksFirst, we need to be clear about what is actually happening when a honey bee stings you. Rather than a clean hypodermic needle, a honey bee's stinger is actually covered in barbs.Electron micrograph of a honey bee's stinger (650x) from Rose-Lynn Fisher’s book, BEELooks like a very fancy fishhook right? Except it's more gruesome than a fishhook, because after a bee has stung you, it tries to fly away. The barbs keep its stinger in place and the result is the picture at the top of this article. Ouch.So at a first glance, the answer to the main question is easy. A honey bee dies when it stings you because its stinger is covered in barbs, causing its abdomen to get ripped out when it tries to fly away. And surviving with your guts spilling out everywhere is pretty bloody hard.But why on Earth would evolution have favoured such a suicidal mechanism? Isn't natural selection supposed to favour survival of the fittest not survival of the suicidal?A biological poison pumpIf we take a look at the entire mechanism of the honey bee stinger we can begin to understand why this suicidal strategy is so effective.Although the ripping out of the stinger does cause the bee to eventually die, in this process, a venom sack along with a muscular pump are also left behind.Image by StatedClearlyRather than just sitting in your skin like a static fishhook, the stinger continues to pump venom into your skin long after the bee has flown away. This is made possible by the autonomous muscles and nerves in this pump, which work independently from the rest of the bee's nervous system. Up close in real life, this is pretty creepy and zombie-like.If you don't pull the stinger out, the pump will keep on delivering every last drop of venom right into your skin. This mechanism is much more effective in terms of 'sting to volume of venom delivered' ratio compared to the short prick of a wasp.Though this is actually an interesting comparison, because to us, a wasp's sting is just as painful as, if not even more painful than, a bee's. Wasps can also sting you several times without dying, multiplying the pain, so what gives?Why does a bee have to die via this complicated, suicidal venom-pump mechanism whilst the wasps seem to do just fine with their non-barbed stingers?Super-organisms, the immune system and colonial lifeA simple answer to that would be: \"bees die to defend the colony.\" Although compelling on the surface, this explanation would give a huge incentive for any individual bee to just hope that someone else sacrifices themselves other than them. If you lived in a group of willingly sacrificial bees, it would be a very good strategy for you to be selfish and not sacrifice yourself. You can safely bet that someone else will take care of the cumbersome suicide, while you can kick back and enjoy the good life. So why haven't selfish non-barbed-stinger bees become the norm?To dig deeper, we need to look not just at the anatomy of the stinger itself but at the broader reproductive biology of the honey bee. As I've mentioned previously on the blog, honey bee colonies have a distinctive social structure with the queen doing all the reproductive work, the female workers carrying out the honey production and the male drones providing the matching 16 chromosomes to fertilise bee eggs. Drones don't do much for the colony besides that, and they don't have stingers like the workers or the queen.The key point here is that the worker bees are reproductive dead ends for the wider colony (though there are some exceptions). So from an evolutionary perspective, it doesn't matter too much if they die, since they were never going to have kids anyway. This does not mean that they are useless. To see this, we can look at our own immune systems. For instance, immune cells inside your body known as neutrophils are just as suicidal as the worker bees. When bacteria invade your body, neutrophils migrate to the site of infection, unleash a whole cocktail of toxins onto the bacteria, and then proceed to die within 1-2 days. In both cases, the suicidal nature of neutrophils and that of worker bees benefit the bigger entity that surrounds them. For worker bees, their death may save the colony from Winnie the Pooh, and the death of Neutrophils may save you from dying from a bacterial infection. In both cases, the reproductive parts (the queen or the genitals) of each broader entity are preserved, whilst a disposable part (workers or neutrophils) which was never going to reproduce anyway, is destroyed.  And for natural selection to do its thing, all we need are the reproductive parts to stay intact.This line of thinking really does lead us to think of honey bee colonies as single super-organisms. Workers are just the cells of the organism that aren't going to have kids, so when they die, nothing too bad happens. Just like when you're skin cells or neutrophils die, which happens everyday by the way.More importantly, with this distinction made, the \"defence of the colony\" explanation can be made to work if we reframe it slightly in terms of \"defence of the queen\" or \"defence of the genitals.\" The Mini Adventures of Winnie the Pooh / Walt Disney Animation StudiosThis actually isn't the full story because as I'm sure you're aware, wasps also live in nests and so we could apply the same super-organism logic to them. Worker wasps ought to be just as dispensable as worker bees.The reasons for why wasps are less suicidal than bees actually leads us down a different evolutionary path which we won't touch. But in short, wasps are just a more aggressive species than bees. Many species of wasps also live in eusocial colonies, though worker wasps do not have barbed stingers.Ignoring this caveat, it still leaves the question of why super-organisms and colonial life evolved in the first place. I mean, we humans and nearly all other mammals certainly don't have a singular queen and a sterile caste of workers.Group selectionDarwin himself recognised that the social insects (like wasps and bees) posed a problem for his theory of natural selection. Strict 'survival of the fittest' would seem to render eusociality, the extreme form of biological sociality found in these insects, impossible.His own explanation for their existence involved an early form of group selection. We have since adapted it and modified it, though some biologists still get really triggered about group selection and deny its evolutionary importance. Ignoring that, here's how the theory would explain the evolution of eusociality.Consider a group of non-social bees. That is, a group that happens to live together but with no colonial social structure or any other social hierarchy that we see in honey bees today. So there is no queen and every bee can reproduce. Now imagine that one of these bees happens to be particularly nice and decides to share the food that it harvests with the rest of the group. For the altruistic bee, this strategy is pretty terrible because she is giving away food that she has worked hard to collect. But for everyone else, this is great - they don't have to do as much work! The receivers of free food can relax just a little and maybe spend their time doing other things. Perhaps even focussing on defending the group from predators with their new free time, instead of searching for food.This bring us to the levels of selection in biology. On the individual level, it makes no sense to be altruistic; you're giving free food away for nothing in return. But on the group level, the presence of altruists is actually good as it can (in theory) increase the survivability of everyone, and therefore the reproductive fitness, of the entire group.Comparatively, an all selfish group of bees may be more susceptible to predators as each individual's efforts are divided up between defence and searching for food. This group is less cohesive and easier to attack.In this way, groups that have more altruists are more likely to survive, and the individuals within them are more likely to reproduce. The altruists among them in the group, pass on their altruistic traits, favouring the evolution of altruism and eusociality in groups. This is group selection.It is often naively said that altruistic traits can evolve because they favour the 'good of the group' or even more broadly the 'good of the species.' We need to be very careful with such phrases, especially the latter, because most individuals could not care less what happens to the rest of the species. Modern biologists who support group selection are usually careful to point out the interactions between the levels of selection, like I did in my description above. For this explanation to work, group level benefits (extra defence) have to outweigh individual level costs (giving away free food).To highlight this nuance, group selection is commonly referred to as multi-level selection. We can also use maths to balance out the forces of individual-level selection and group-level selection. Hint: It's the Price equation again.Group selection provides a possible mechanism for why altruistic traits, and therefore eusocial colonies like those of honey bees, may have evolved. But this doesn't explain why we only see eusociality in a select few species like wasps and bees, but not most others. The nice story I told above about the evolution of altruism could just have easily been applied to humans. Yet we do not exist in eusocial colonies, so there must be something else going on. Kin selection and biological altruismIn 1964, William D. Hamilton popularised a theory which became to be known as kin selection. In his groundbreaking paper, he provided a model to explain why eusociality was pretty much only seen in species of the order Hymenoptera which includes bees, wasps and ants.Hamilton's first realisation was that Hymenopteran genetics is really weird. This was well known at the time, but he was the first person to truly understand the consequences of such a system.In Hymenoptera, all males come from unfertilised eggs, that is they only have a mother but no father. Females however, hatch out of fertilised eggs and get half their genes from each of their parents, much like us humans. This system of sex determination is known as haplodiploidy, as opposed to the diploid system found in mammals. The sex determination system in eusocial honey bees, part of the order Hymenoptera. Drones are haploid (only have their mother's genes) whilst workers are diploid.Now why does all this talk of genetics matter? Well, we can now assume that there is some gene that encodes for altruism.When I was first learning about kin selection, this assumption really troubled me. Of course, there is no single gene that encodes for an altruistic trait. That's way too simple and completely ignores the role of cognition and the environment. But what we can assume, which is considerably more reasonable, is that there is some gene that mildly inclines an individual to be more altruistic. With enough of these very slightly altruistic genes, the actual altruistic trait might emerge. For bees, we can imagine that one particular gene may make the barbs on its stinger ever so slightly longer. Another confusion I had was the clash in the meaning of the word \"altruism\" in biology and in everyday conversation. Biological altruism refers to an individual giving up some of their reproductive fitness to help another individual reproduce. These altruistic acts are typically not done consciously, they have simple been formed by natural selection to act in this way. For instance, your neutrophils do not consciously commit suicide, they have just been shaped to do that by evolution. And of course you don't go out thinking \"Hm yes I will save you two from drowning because you are each 5/8 related to me.\" Although maybe one biologist did actually think like this.The best analogy I can think of is the following. To catch a ball in the air requires your brain to do some pretty complex calculus, but you never once think of all this consciously. Same with all this relatedness business.With that cleared up, Hamilton's insight was now two-fold:You can spread your genes 'through' your relatives.The haplodiploid system skews the relatedness between sisters.Let's go through each of these individually.First, we need to take the 'gene's eye view' of evolution for all of this to make sense. So imagine that you are an altruistic gene and that your goal is to maximise your own personal fitness. Irrespective of your downstream function, you only have your own selfish interests at heart. That is, you only care about creating more copies of yourself.This perspective was precisely why Richard Dawkins named his book The Selfish Gene. And although there is a lot of anthropomorphising to make the analogy work, it is useful to understand how kin selection operates.Here's where the apparent altruism comes in. Imagine that there is some external pressure, say a predator, that will cause everyone in your group to die if nothing is done. If however, one of you sacrifices yourself to the scary predator, you can save everyone else.As a slightly-altruistic gene, you are more inclined to make the individual that you live inside conduct this sacrificial act. From the group selection perspective, this action never made any sense for the individual. But from the gene's eye view, this can actually be beneficial if you happen to save some other individuals that also contain a copy of yourself.This is a way of replicating yourself through others instead of directly.The individuals you save which do not contain a copy of you are essentially wasted energy; you're saving them for no reason. So for kin selection to work, it's very important that the individuals that you do happen to save are closely related to you, in order to maximise your chances of saving copies of yourself. This is the 'kin' part in kin selection. Notice that when this reproduction through relatives occurs, the gene for altruism spreads and the descendant individuals will end up slightly more altruistic.Indirect fitness and the haplodiploidy hypothesisThe easiest way to conceptualise this process is through the concept of indirect fitness. This is a formal way of expressing \"passing on your genes through relatives\" as opposed to having kids yourself. Reflecting upon this fact, another 20th century biologist, J.B.S. Haldane famously said:I would gladly give up my life for two brothers or eight cousins.This is because in humans, you share half of your genes with your siblings (and each of your parents) and an eighth of your genes with first-cousins. In Hymenoptera however, the situation is more complex precisely because of their strange genetics.Let's have another thought experiment to see this in action. Imagine that you are now a female bee and that you have two options during mating season:Help your mum to have more babies (producing more siblings in relation to you).Have your own kids.And rather than jumping to option 2 which intuitively sounds more reasonable, we can use our new tools of kin selection and indirect fitness to work out which one is actually better for you. Remember that we want to maximise the genes that we pass on, so higher relatedness to new individuals produced is better.If you have a child as a Hymenopteran female, no matter whether it turns out to be male or female, you will have passed on half of your genetic material. Nothing too weird yet, this is the same as us.If on the other hand, you help your mum to have another daughter, how related are you to your new sister? Well, both of you have the same father who has passed on his entire set of genes to both of you. And you each have gotten some random half of your mother's genes (via meiosis). So adding all of that up, you actually share three-quarters of your genes with your sister not half!Amount of genetic relatedness (R) between relatives. In jargon-speak, R is the identity by descent between individuals. Each sister has a copy of their father's genes (the brown chromosome) plus half of their mother's genes (the blue/red chromosome of which the sisters have half in common).For those of you familiar with genetics: Male Hymenopterans do not undergo any meiosis, so their gametes are all essentially clones of themselves. Females do undergo standard meiosis which gives them the standard R=1/2 relatedness to all offspring. Combining these together gives R=3/4 between sisters, assuming a common father.With such high relatedness between sisters (3/4 > 1/2), it actually makes more sense to use your mother as a 'sister-producing factory' to maximise the genes that you pass on as a female bee. This is the indirect fitness concept at its finest and it also gives a very good explanation for why worker bees are so disposable. All that matters to the workers is that this sister-producing factory (the queen) is preserved. They don't care about reproducing on their own.Thus, the 3/4 relatedness between Hymenopteran sisters gives the additional boost required to favour the evolution of eusociality via kin selection. This is Hamilton's haplodiploidy hypothesis, and it is a pretty compelling explanation for why eusociality seems to have mostly cropped up in only one order of life, one which happens to have haplodiploid genetics.The haplodiploidy hypothesis isn't perfectThe haplodiploidy hypothesis, though nice, is not without its problems. Firstly, there are plenty of species with haplodiploid genetics which do not form eusocial colonies. This includes many species of solitary bees, wasps and some rotifers. So being a haplodiploid species is not synonymous with eusociality.Secondly, there are also instances of diploid species that are social. One is the very strange naked mole rat which I think definitely earns the title of \"strangest mammal alive today\".Thirdly, the haplodiploidy hypothesis only works if all sisters share the same father and if a queen is biased to produce more daughters than sons. Both of these conditions are not often satisfied in modern honey bee species. Queens often mate with more than one male (resulting in multiple fathers) and sex ratios are usually equal in most species, not female-biased.Many additional models have been proposed to fix these problems, and it is an active area of research today. One simple fix is having some colonies with female-biased sex ratios and others with male-biased sex ratios. Overall, this keeps a 50/50 balance in the whole population but allows for kin selection to operate locally with the 3/4 relatedness boost within certain colonies.Despite its problems, the core idea of Hymenopteran genetics favouring the evolution of eusociality seems to hold up pretty well.ConclusionSo why do bees die when they sting you? Well, it ultimately depends on which biologist you ask. Perhaps because they're disposable parts of a larger super-organism which has evolved by multi-level selection. Perhaps because they're happy to die for their sister-producing factory known as the queen, fuelled by kin selection and the haplodiploid genetics of the Hymenoptera.Nothing is certain because we don't have a time machine to trace the evolution of bees. Biologists are certainly still debating about it and neither kin nor group selection has reached unanimous consensus.Jake\n        ",
    url: 'https://www.subanima.org/bees/',
    source: 'SubAnima',
    title: 'Why do bees die when they sting you? (2021)',
    storyId: 42749069,
    hnUrl: 'https://news.ycombinator.com/item?id=42749069',
  },
  // @ts-expect-error no comments needed
  {
    content:
      '\n        \n    \n        \n    \n\nThis article describes how I generate an infinite city using the Wave Function Collapse algorithm in a way that is fast, deterministic, parallelizable and reliable.\nIt\'s a follow-up to my 2019 article on adapting the WFC algorithm to generate an infinite world.\nThe new approach presented in this article removes the limitations of my original implementation.\nI first mentioned these ideas in this Twitter thread.\nObjective\nThe goal is to procedurally generate a 3D environment by placing human designed blocks on a 3D grid.\nThe blocks need to be placed in accordance with given adjacency contraints.\nFor each of the 6 sides of each block, some information about the face and its symmetry is used to generate a list of possible neighbors.\n\n    \n        \n    \n\nThis is different from the original formulation of the WFC algorithm, where the possible blocks, their adjacency rules and their spawn probabilities are extracted automatically from an example texture.\nIn this improved version, the generation method is robust enough to be shipped in a commercial game, so it needs to be reliable, fast and allow for artistic control over the result.\nWave Function Collapse\nThis article is aimed at readers who already know how the WFC algorithm works, but here is a brief recap.\nRemember, I\'m skipping the part where blocks are extracted from an example texture and I\'m only using the part where we generate a new "texture".\n\n    \n        \n    \n\n(Gif by Maxim Gumin on Github)\nThe algorithm starts with an array of slots (the "wave function"), where nothing is decided.\nEach slot has a list of possible blocks (or "modules") that can be placed there and in the starting state, each list contains all modules.\nThe algorithm will then do collapse steps and a constraint propagation steps until the map is fully collapsed or until it has reached a dead end.\nCollapse step\nWe pick the slot with the lowest entropy and collapse it.\nThat means we pick one of the modules from that slot\'s list of possible modules and set it as the selected module for this slot.\nIntuitively, the "slot with the lowest entropy" is the one with the least amount of choice.\nIf all modules have the same spawn probability, the slot with the fewest possible modules is the one with the lowest entropy.\nConstraint propagation\nCollapsing a slot effectively shrinks the list of possible modules of that slot to 1.\nThe constraint propagation step propagates this information through the map by removing modules from the respective lists of other slots that relied on a different choice for the slot we just collapsed.\nThe constraint propagation step of the WFC algorithm is the most compute intensive part.\nEnd\nThe algorithm terminates when all slots are collapsed, which means success, or when the list of possible modules for any slot is empty.\nIn that case the procedure has failed and one could backtrack or start over.\nThe original approach and its limitations\n(skip this section if you just want to know the solution)\nWFC is usually applied to finite maps that can be stored in an array.\nIn my original post, I described why I thought it would be impractical to do a chunk-based WFC implementation.\n(I had not figured out how to avoid the problem that constraints need to be propagated across chunk boundaries)\nInstead, I stored the map in a dictionary, where new slots would be allocated when they were needed or when they were touched by constraint propagation.\nThat means, even to geneate a small area of the map, a large cloud of slots around that area would be allocated since constraint propagation could "bounce back" into the area we\'re interested in.\nProblems of that approach include:\nNon-determinism: The result of the generation depends on the order in which parts of the map are generated (and thus on the path the player takes).\nMemory leak: We can\'t release the memory used to generate a part of the world when the player leaves since we don\'t know at what point distant slots no longer have an effect on local world generation.\nReliability: The longer you walk around, the higher the chance becomes that the WFC algorithm runs into a dead end and is unable to continue generating the map.\nSingle threaded: Since there are no chunks, all operations on the map datastructure need to be sequential and can\'t run in multiple threads.\nIn practice, the map height had to be limited so that the map generation was fast enough.\n\n    \n        \n    \n\nMy implementation of this flawed approach is still available on Github and a playable demo is on itch.io.\nIf you want to implement your own WFC algorithm, you shouldn\'t do it like that though!\nChunk-based WFC\nThe idea is to start with a simple pre-generated, tiling map and generate "fitting" replacements at runtime.\nHowever, we do this at an offset so that the seam (which would otherwise look the same for each chunk) is replaced.\nIn this section, I\'ll explain in detail what that means.\nThis solution is a refinement of ideas proposed by Paul Merrel and BorisTheBrave.\nWe start by generating a simple, finite, tiling, 8x8x8 map:\n\n    \n        \n    \n\nThis is done offline.\nWe use a small subset of the available modules to make it as simple as possible.\nThe map is tiling in the sense that the boundaries on opposite sides match, so copies of this map could be placed next to each other seamlessly.\nDoing that would look like this:\n\n    \n        \n    \n\nGenerating a tiling map is done by "wrapping around" the constraint propagation at the map boundary.\nIn a finite map, when we propagate a constraint to a slot outside the map, we discard that information.\nIn a tiling map, the slot on the opposing map boundary is treated as if it was a neighbor.\nNext, we pre-generate a set of replacements for our starting map.\n\n    \n        \n    \n\nWe use the boundary of the starting map as a boundary constraint to generate these replacements.\nFor any slots on the boundary of these new maps, we only allow modules with a matching profile for those sides that face the map boundary.\nThis means that we can "swap out" our starting map with any of the pre-generated patches without creating a visible seam.\nNow we can randomly choose from our collection of pre-generated patches at runtime and we have a simple chunk-based infinite world generator:\n\n    \n        \n    \n\nNote that we\'re not doing any WFC generation at runtime yet, we\'re just placing pre-generated 8x8x8 block patches.\nSince all these patches have a matching boundary, we can spot this chunk boundary as an unnatural pattern in the generated world.\nNow for the important part:\nAt runtime, we generate an 8x8x8 replacement map for each chunk, but we do it at a 4 block offset in both horizontal directions.\nThe starting point for each chunks\'s generation is made up of the four pre-generated patches that touch it.\nThe replacement map we generate at runtime has a boundary constraint to "fit in", just like our pre-generated patches.\nHowever, due to the offset, the boundary that is shared between all pre-generated patches is replaced at runtime and the area that is different in every pre-generated patch remains unchanged during the runtime generation.\n(This is needed so that neighbor chunks can be generated independently from each other.)\nIf this replacement map fails to generate, we just copy the blocks from the starting patches.\nHere is the result of that:\n\n    \n        \n    \n\nNotice how the chunk boundary artifacts from the previous screenshot are gone!\n\n    \n        \n    \n\nConsider this drawing, where the gray blocks are one chunk (seen from above).\nWe determine the four starting patches that overlap this chunk (the blue boxes).\nThis needs to be random but deterministic, since neighbor chunks will need to use the same information.\nWe query the pre-generated patches at the boundary of the chunk (shown in green) and use this as the boundary constraint for the generation of the chunk.\nThe green boundary area will stay the same during runtime generation, but this looks ok due to the variance in the pre-generated patches.\nThe blue boundary is the same for each pre-generated patch, but will be replaced at runtime.\nNote how this has the properties we want:\nEach chunk can be generated deterministically and independently from other chunks.\nIf the generation for one chunk fails, we simply copy the blocks from the starting patches.\nUsing a heightmap\nIn this section, I\'ll explain how to generate a world in the shape of an arbitrary heightmap.\nConsider an integer heightmap where the difference between two adjacent points is always one.\nThe next point is either one above or one below, but never at the same level or anywhere else.\nEach 2x2 cell in that heightmap has one of these six shapes:\n\n    \n        \n    \n\nFor each of these six possible 2x2 cell shapes, we pre-generate a set of starting patches:\n\n    \n        \n    \n\nThese starting patches are no longer tiling in the classic sense.\nInstead, each side matches the opposite side with a vertical offset.\nWith our special integer heightmap where adjacent points always have a difference of 1, we will now generate one chunk for each point in the heightmap.\nOur query point has four adjacent 2x2 cells.\nFor each 2x2 cell, we determine which of the six possible shapes it has and pick a pre-generated starting patch from the respective collection.\nThen, we generate a replacement map as explained in the previous section.\nHere is an example of the heightmap in engine, each chunk is represented as one flat quad:\n\n    \n        \n    \n\nThis mesh is used to render the world far away from the camera.\nI added a "city like" texture and some billboard-rendered fake buildings.\nIn the foreground, you can see the actual chunks generated by the algorithm:\n\n    \n        \n    \n\nOkay, now we know how to turn our integer heightmap into a cool looking infinite WFC world, but how do we get that integer heightmap in the first place?\nHow do we get a function that generates an integer elevation function where the vertical difference between two adjacent points is always 1 or -1, but never 0 or anything else?\nWe start with a target function that doesn\'t have this property.\nIn my case, I\'m using 8 octaves of Perlin noise, but any heightmap can be used here.\nThen, we use an elaborate clamping process to force the step constraint on our target function.\nIt works in a hierarchical way, similarly to descending down a quadtree.\nWe start with a relatively large square (the root of the quadtree) and evaluate our target function for the four corners.\nThen, we generate the heightmap value on the edge centers and the square center by querying the target function and then clamping the value to fulfil our slope constraint.\nThe slope constraint requires that the vertical difference is less than or equal the horizontal difference.\nIf our query point is inside any of the four quadrants, we repeat this process for the respective quadrant (descending the quadtree).\nIf our query point is one of the points we just calculated, we\'re done.\nThe hierarchical nature of this approach means that it lends itself very well to caching.\nHere is a 2D visualization of the process:\n\n    \n        \n    \n\nThe blue line shows the target function.\nAt every descend step down the quadtree, new limits are introduced to adhere to the slope constraint (shown as black lines).\nThe orange dots are the values of our resulting heightmap.\nOutlook and notes\nEach chunk can be generated independently.\nThat makes it easy to parallelize the computation required to generate the world.\nIn my case, I\'m using Unity\'s Burst compiler to do the runtime generation.\nBy varying the module probabilities for different areas of the map, I can generate different biomes.\nHere is an example of a biome boundary:\n\n    \n        \n    \n\nThe biome on the left spawns copper roofs and bridges, the one on the right spawns tiled roofs and arches.\nOn the boundary, there is one row of chunks where modules from both biomes can spawn, creating a natural looking transition.\nI want to mention some progress on this project that is unrelated to the WFC algorithm.\nSince my last blog post in 2019, I\'ve created lots of new blocks, textured them, added a water plane and added procedurally generated trees and climbing plants.\n\n    \n        \n    \n\nThe trees and plants are generated at runtime using the Space Colonization algorithm and adapt to the geometry of the world.\nThe next challenge is to come up with interesting gameplay ideas for this project.\n\n    ',
    url: 'https://marian42.de/article/infinite-wfc/',
    source: "Marian's Blog",
    title: 'Generating an infinite world with the Wave Function Collapse algorithm',
    storyId: 42700483,
    hnUrl: 'https://news.ycombinator.com/item?id=42700483',
  },
  // @ts-expect-error no comments needed
  {
    content:
      '     \nBeyond coding.\nWe forge.            Forgejo\nis a self-hosted lightweight software forge.\nEasy to install and low maintenance, it just does the job.\n \nBrought to you by an inclusive community under the umbrella of\nCodeberg e.V., a democratic non-profit organization, Forgejo can be trusted to be exclusively Free Software. You can\n\t\t\t\t\t\tcreate an account on\nCodeberg\nand\nother instances\nor download it to self-host your own. It focuses on security, scaling, federation and privacy. Learn more about\nhow it compares with other forges.\n       \nForge great software with Forgejo\n \nTake back control of your software development process, self-host your projects and get everyone involved in\n\t\t\t\tdelivering quality software on the same page.\n      Simple software project management  Ease of use is important to get things done efficiently. Forgejo’s user experience is designed for collaboration and productivity.   Self-hosted alternative to GitHub  Liberate your software from proprietary shackles. Forgejo offers a familiar environment to GitHub users, allowing smooth transition to a platform you own.   Easy to install and maintain  Hosting your own software forge does not require expert skills. With Forgejo you can control your server with minimal effort.     Lightweight and performant  With a rich feature set, Forgejo still has a low server profile and requires an order of magnitude less resources than other forges.   Guaranteed 100% Free Software  Forgejo will always be Free and Open Source Software. Furthermore we exclusively use Free Software for our own project development.   Beyond coding, we forge ahead  An exciting future awaits. We will innovate the Software Forge and enable collaborative software development facilitated by decentralized platforms.      \nGet Involved\n  \nForgejo consists of motivated people, and we are looking forward to\nyour contribution .\nFeel free to help in the domains of\nlocalization,\ncode, federation, releases management,\nuser research,\nUX and usability,\ncommunity management,\ndocumentation,\nweb design,\ngovernance and more.\n        Contribute on Codeberg\n       Donate\n    ',
    url: 'https://forgejo.org/',
    source: 'forgejo.org',
    title: 'Forgejo: A self-hosted lightweight software forge',
    storyId: 42753523,
    hnUrl: 'https://news.ycombinator.com/item?id=42753523',
  },
]
