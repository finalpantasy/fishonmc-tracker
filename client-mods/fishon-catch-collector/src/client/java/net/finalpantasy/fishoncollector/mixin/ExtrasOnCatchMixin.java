package net.finalpantasy.fishoncollector.mixin;

import net.finalpantasy.fishoncollector.FishOnCatchCollectorClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(targets = "dannypx.foe.handler.logic.EventHandler", remap = false)
abstract class ExtrasOnCatchMixin {
    @Inject(method = "onCatch", at = @At("HEAD"), remap = false)
    private void fishoncollector$recordCurrentCatch(CallbackInfo callbackInfo) {
        FishOnCatchCollectorClient.recordCurrentCatch();
    }
}
