import {
    GameObjectDefs,
    type LootDef,
    WeaponTypeToDefs,
} from "../../../../shared/defs/gameObjectDefs";
import { type EmoteDef, EmotesDefs } from "../../../../shared/defs/gameObjects/emoteDefs";
import {
    type BackpackDef,
    type BoostDef,
    type ChestDef,
    GEAR_TYPES,
    type HealDef,
    type HelmetDef,
    SCOPE_LEVELS,
    type ScopeDef,
} from "../../../../shared/defs/gameObjects/gearDefs";
import type { GunDef } from "../../../../shared/defs/gameObjects/gunDefs";
import { type MeleeDef, MeleeDefs } from "../../../../shared/defs/gameObjects/meleeDefs";
import type { OutfitDef } from "../../../../shared/defs/gameObjects/outfitDefs";
import { PerkProperties } from "../../../../shared/defs/gameObjects/perkDefs";
import type { RoleDef } from "../../../../shared/defs/gameObjects/roleDefs";
import type { ThrowableDef } from "../../../../shared/defs/gameObjects/throwableDefs";
import { UnlockDefs } from "../../../../shared/defs/gameObjects/unlockDefs";
import {
    type Action,
    type Anim,
    GameConfig,
    type HasteType,
} from "../../../../shared/gameConfig";
import * as net from "../../../../shared/net/net";
import { ObjectType } from "../../../../shared/net/objectSerializeFns";
import type { GroupStatus } from "../../../../shared/net/updateMsg";
import { type Circle, coldet } from "../../../../shared/utils/coldet";
import { collider } from "../../../../shared/utils/collider";
import { math } from "../../../../shared/utils/math";
import { assert, util } from "../../../../shared/utils/util";
import { type Vec2, v2 } from "../../../../shared/utils/v2";
import { Config } from "../../config";
import { IDAllocator } from "../../utils/IDAllocator";
import { validateUserName } from "../../utils/serverHelpers";
import type { Game, JoinTokenData } from "../game";
import { Group } from "../group";
import { Team } from "../team";
import { WeaponManager, throwableList } from "../weaponManager";
import { BaseGameObject, type DamageParams, type GameObject } from "./gameObject";
import type { Loot } from "./loot";
import type { MapIndicator } from "./mapIndicator";
import type { Obstacle } from "./obstacle";

import type { Player, Bot, DumBot} from "./player";

export class BotUtil {
    static dist2(a: Vec2, b: Vec2) {
        return ((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }

    static noNearbyBullet(bot: Player): boolean {
        const nearbyBullet = bot.game.bulletBarn.bullets
            .filter(
                (obj) =>
                    obj.active && obj.alive && (obj.player === undefined || !this.sameTeam(bot, obj.player)),
            );

        nearbyBullet.forEach((b) => {
            // change logic -- where it will go to? but not too far away
            let dir = b.dir;
            let pos = b.pos;

            let dist = this.dist2(bot.pos, pos); // distance bullet position to player
            let perp = v2.perp(b.dir);
            let perpDist = v2.lengthSqr(v2.proj(v2.sub(bot.pos, pos), perp));

            let targetD = (GameConfig.player.reviveRange * 1.5) ** 2;

            if (dist <= targetD * 200 && perpDist <= targetD) {
                // stop moving in straight line
                // testing below
                // this.game.playerBarn.addEmote(
                //     this.__id,
                //     this.pos,
                //     "emote_dabface",
                //     false,
                // );
                return false;
            }
        });

        return true;
    }

    static same(one: Team | Group | undefined, two: Team | Group | undefined): boolean {
        if (one === undefined) {
            return false;
        }
        return (one === two);
    }

    static sameTeam(a: Player | undefined, b: Player | undefined): boolean {
        if (this.same(a?.team, b?.team))
            return true;
        if (this.same(a?.group, b?.group))
            return true;

        return false;
    }
}