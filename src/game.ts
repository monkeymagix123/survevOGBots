import { type WebSocket } from "uWebSockets.js";
import { type PlayerContainer } from "./server";
import { type Msg, MsgStream, MsgType } from "./net/net";
import { Player } from "./objects/player";
import { v2 } from "./utils/v2";
import { InputMsg } from "./net/inputMsg";
import { Grid } from "./utils/grid";
import { JoinMsg } from "./net/joinMsg";
import { type GameObject } from "./objects/gameObject";
import { type ConfigType } from "./config";
import { GameMap } from "./map";
import { Logger } from "./utils/misc";
import { Bullet, type BulletParams } from "./objects/bullet";
import { type ExplosionData } from "./net/updateMsg";

export class Game {
    stopped = false;
    allowJoin = false;
    over = false;
    startedTime = 0;

    nextObjId = 0;

    nextGroupId = 0;

    players = new Set<Player>();
    connectedPlayers = new Set<Player>();
    livingPlayers = new Set<Player>();

    get aliveCount(): number {
        return this.livingPlayers.size;
    }

    aliveCountDirty = false;

    msgsToSend: Msg[] = [];

    partialObjs = new Set<GameObject>();
    fullObjs = new Set<GameObject>();

    newPlayers: Player[] = [];

    bullets = new Set<Bullet>();
    newBullets: Bullet[] = [];

    explosions: ExplosionData[] = [];

    id: number;

    map: GameMap;

    grid: Grid;

    tickInterval: NodeJS.Timeout;
    dt: number;

    config: ConfigType;

    now = Date.now();

    tickTimes: number[] = [];

    constructor(id: number, config: ConfigType) {
        const start = Date.now();

        this.id = id;
        this.config = config;

        this.grid = new Grid(1024, 1024);
        this.map = new GameMap(this);

        this.dt = 1000 / config.tps;
        this.tickInterval = setInterval(() => this.tick(), this.dt);

        this.allowJoin = true;

        Logger.log(`Game ${this.id} | Created in ${Date.now() - start} ms`);
    }

    tick(): void {
        this.now = Date.now();

        for (const bullet of this.bullets) {
            bullet.update();
            if (!bullet.alive) {
                this.bullets.delete(bullet);
            }
        }

        for (const player of this.players) {
            player.update();
        }

        for (const player of this.connectedPlayers) {
            player.sendMsgs();
        }

        //
        // reset stuff
        //
        for (const player of this.players) {
            for (const key in player.dirty) {
                player.dirty[key as keyof Player["dirty"]] = false;
            }
        }

        this.fullObjs.clear();
        this.partialObjs.clear();
        this.newPlayers.length = 0;
        this.msgsToSend.length = 0;
        this.newBullets.length = 0;
        this.explosions.length = 0;
        this.aliveCountDirty = false;

        // Record performance and start the next tick
        // THIS TICK COUNTER IS WORKING CORRECTLY!
        // It measures the time it takes to calculate a tick, not the time between ticks.
        const tickTime = Date.now() - this.now;
        this.tickTimes.push(tickTime);

        if (this.tickTimes.length >= 200) {
            const mspt = this.tickTimes.reduce((a, b) => a + b) / this.tickTimes.length;

            Logger.log(`Game ${this.id} | Avg ms/tick: ${mspt.toFixed(2)} | Load: ${((mspt / this.dt) * 100).toFixed(1)}%`);
            this.tickTimes = [];
        }
    }

    addPlayer(socket: WebSocket<PlayerContainer>): Player {
        const player = new Player(
            this,
            v2.add(v2.create(100, 100), v2.mul(v2.randomUnit(), 10)),
            socket);

        return player;
    }

    addBullet(params: BulletParams): Bullet {
        const bullet = new Bullet(this, params);
        this.bullets.add(bullet);
        this.newBullets.push(bullet);
        return bullet;
    }

    handleMsg(buff: ArrayBuffer, player: Player): void {
        const msgStream = new MsgStream(buff);
        const type = msgStream.deserializeMsgType();
        switch (type) {
        case MsgType.Input: {
            const inputMsg = new InputMsg();
            inputMsg.deserialize(msgStream.stream);
            player.handleInput(inputMsg);
            break;
        }
        case MsgType.Join: {
            const joinMsg = new JoinMsg();
            joinMsg.deserialize(msgStream.stream);
            let name = joinMsg.name;
            if (name.trim() === "") name = "Player";
            player.name = name;
            player.joinedTime = Date.now();

            this.newPlayers.push(player);
            this.grid.addObject(player);
            this.connectedPlayers.add(player);
            this.players.add(player);
            this.livingPlayers.add(player);
            this.aliveCountDirty = true;
            break;
        }
        }
    }

    removePlayer(player: Player): void {
        this.connectedPlayers.delete(player);
    }
}
