package net.finalpantasy.fishoncollector;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

final class ExtrasStatsSnapshotTest {
    @Test
    void parsesFoerCountsPercentagesDryStreaksAndRewards() {
        ExtrasStatsSnapshot snapshot = ExtrasStatsSnapshot.fromJson("""
                {
                  "fishTotal":143,
                  "fishData":{
                    "rarity":{"common":{"amount":66,"caughtOn":143}},
                    "size":{"baby":{"amount":21,"caughtOn":139}}
                  },
                  "petTotal":2,
                  "petData":{"rarity":{"common":{"amount":2,"caughtOn":91}}},
                  "itemData":{
                    "armorShard":{"amount":25,"caughtOn":109},
                    "package":{"amount":4,"caughtOn":100},
                    "chummer":{"amount":2,"caughtOn":78}
                  }
                }
                """);

        assertEquals(143, snapshot.fishTotal());
        assertEquals(66, snapshot.fishCount("rarity", "common"));
        assertEquals(46.2, snapshot.fishPercent("rarity", "common"), 0.05);
        assertEquals(0, snapshot.fishDry("rarity", "common"));
        assertEquals(4, snapshot.fishDry("size", "baby"));
        assertEquals(2, snapshot.petTotal());
        assertEquals(52, snapshot.petDry());
        assertEquals(25, snapshot.itemCount("armorShard"));
        assertEquals(34, snapshot.itemDry("armorShard"));
        assertEquals(4, snapshot.itemCount("package"));
        assertEquals(43, snapshot.itemDry("package"));
        assertEquals(2, snapshot.itemCount("chummer"));
        assertEquals(65, snapshot.itemDry("chummer"));
    }

    @Test
    void exposesEveryExtrasTrackedRewardWithoutHardCodingItemKeys() {
        ExtrasStatsSnapshot snapshot = ExtrasStatsSnapshot.fromJson("""
                {
                  "fishTotal":10,
                  "petTotal":2,
                  "itemData":{
                    "armorShard":{"amount":4,"caughtOn":9},
                    "futureReward":{"amount":3,"caughtOn":10}
                  }
                }
                """);

        assertEquals(Map.of("pet", 2, "armorShard", 4, "futureReward", 3), snapshot.rewardCounts());
    }
}
