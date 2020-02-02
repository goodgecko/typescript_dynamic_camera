import { Application, Container, Texture, Sprite, Point } from 'pixi.js'
import { PlayerMovementControl } from './PlayerMovementControl';

export class GameScreen {

    private mapWidth:number;
    private mapHeight:number;

    private mapContainer1:PIXI.Container;
    private mapContainer2:PIXI.Container;
    private playerContainer1:PIXI.Container;
    private playerContainer2:PIXI.Container;

    private playerMoveController1:PlayerMovementControl;
    private playerMoveController2:PlayerMovementControl;

    private player1:PIXI.Sprite;
    private player2:PIXI.Sprite;

    private splitLineGraphic:PIXI.Graphics;
    private mapContainer2Mask:PIXI.Graphics;

    private screenSplit:boolean = false;
    
    private stretchDisance:PIXI.Point;

    private player1SplitDistFromCenter:number;
    private player2SplitDistFromCenter:number;

    private lineWidth:number = 10;
    private lineColor:number = 0xFF0000;

    /**
     * main game class, creates two maps and two players then starts the gameLoop
     * @param app pixi application
     */
    constructor(private app:Application){
        this.mapWidth = app.screen.width * 2.5;
        this.mapHeight = app.screen.height * 2.5;
        
        //distance before the the screen splits
        this.stretchDisance = new PIXI.Point(this.app.screen.width * .5, this.app.screen.height * .4);

        //create two duplicate maps, one fore each player
        this.mapContainer1 = this.createMap();
        this.app.stage.addChild(this.mapContainer1);

        this.mapContainer2 = this.createMap();      
        this.app.stage.addChild(this.mapContainer2);

        //when we are not splitting the screen we remove the mask on mapContainer2, this would hide player1 under mapContainer2 so we have two options:
        //1: create a copy of player 1 on both map containers and move / animate both at the same time
        //2: create an extra container with both players over both maps
        //I'm choosing method 2 because we can now have complex player animations and only have one instance for each player
        this.playerContainer1 = new PIXI.Container();
        this.app.stage.addChild(this.playerContainer1);
        
        //originally I thought one player container would be enough but I need the players to be offset relative to the individual map positions
        this.playerContainer2 = new PIXI.Container();
        this.app.stage.addChild(this.playerContainer2);

        //create player sprites and add them to their relevant containers
        this.player1 = new PIXI.Sprite(Texture.from("player1"));
        this.player1.anchor.set(.5, .5);
        this.player1.x = app.screen.width * .45;
        this.player1.y = app.screen.height * .5;
        this.playerContainer1.addChild(this.player1);

        this.player2 = new PIXI.Sprite(Texture.from("player2"));
        this.player2.anchor.set(.5, .5);
        this.player2.x = app.screen.width * .55;
        this.player2.y = app.screen.height * .5;
        this.playerContainer2.addChild(this.player2);

        this.playerMoveController1 = new PlayerMovementControl(this.app, this.player1, new PIXI.Rectangle(0,0,this.mapWidth, this.mapHeight), ["w","d","s","a"]);
        this.playerMoveController2 = new PlayerMovementControl(this.app, this.player2, new PIXI.Rectangle(0,0,this.mapWidth, this.mapHeight), ["ArrowUp","ArrowRight","ArrowDown","ArrowLeft"]);

        this.splitLineGraphic = new PIXI.Graphics();
        this.app.stage.addChild(this.splitLineGraphic);
        
        this.mapContainer2Mask = new PIXI.Graphics();
        this.mapContainer2.mask = this.mapContainer2Mask;
        this.app.stage.addChild(this.mapContainer2Mask);


        app.ticker.add(delta => this.gameLoop(delta));
    }

    /**
     * creates the map, we need two maps one for each both player
     */
    private createMap():PIXI.Container{
        let map:PIXI.Container = new Container();

        let mapBG1:PIXI.Sprite = new PIXI.Sprite(Texture.from("field"));
        mapBG1.width = this.mapWidth;
        mapBG1.height = this.mapHeight;
        map.addChild(mapBG1);

        //ADD MORE MAP ITEMS HERE

        return map;
    }

    
    private gameLoop(delta:number){
        //update the player movement 
        this.playerMoveController1.gameLoop(delta);
        this.playerMoveController2.gameLoop(delta);

        //find each players position relative to their map, then find the center point between both players
        let player1Local:PIXI.Point = this.playerMoveController1.getPlayerPosition();
        let player2Local:PIXI.Point = this.playerMoveController2.getPlayerPosition();
        let playersCenter:PIXI.Point = new PIXI.Point((player1Local.x + player2Local.x) * .5,  (player1Local.y + player2Local.y) * .5); 
        
        let screenCenter:PIXI.Point = new PIXI.Point(this.app.screen.width * .5, this.app.screen.height * .5);        
        
        //by default both maps want to focused on the point between both players
        //the maps are anchored to the top left
        //so minus playerCenter would put the playerCenter in the top left of screen + half the screen width / height to focues the playerCenter in the center of the screen
        let newMapPos1:PIXI.Point = new Point(-playersCenter.x + screenCenter.x, -playersCenter.y + screenCenter.y);
        let newMapPos2:PIXI.Point = new Point(-playersCenter.x + screenCenter.x, -playersCenter.y + screenCenter.y);


        //we need to find how far the players are from each other, this will be calculated as a percentage relative to the stretchDisance
        let stretchX:number = Math.abs(player1Local.x - player2Local.x) / this.stretchDisance.x;
        let stretchY:number = Math.abs(player1Local.y - player2Local.y) / this.stretchDisance.y;
        let stretchPercentage:number = Math.max(stretchX, stretchY);
        
        
        if(stretchPercentage < 1){
            this.splitLineGraphic.clear();
            this.mapContainer2Mask.clear();
            
            this.screenSplit = false;
        }else if(stretchPercentage > 1){
            if(this.screenSplit == false){
                //when the screen splits we want to try and pivot both players roughly around the same distance from the center of the screen as when they first split 
                let player1Global:PIXI.Point =  new PIXI.Point(this.player1.getGlobalPosition().x, this.player1.getGlobalPosition().y);
                let player2Global:PIXI.Point =  new PIXI.Point(this.player2.getGlobalPosition().x, this.player2.getGlobalPosition().y);
                this.player1SplitDistFromCenter = this.getDistance(player1Global,screenCenter);
                this.player2SplitDistFromCenter = this.getDistance(player2Global,screenCenter);

                this.screenSplit = true;
            }

            let playerAngle:number = this.getAngle(player1Local, player2Local);

            //we want boths players to pivot around the center of the screen reletive to the angle between them
            //with a little bit of maths we can get where on the screen each player should be
            let player1FromCenterX:number = -Math.cos(playerAngle) * (this.player1SplitDistFromCenter)+ screenCenter.x;
            let player1FromCenterY:number = -Math.sin(playerAngle) * (this.player1SplitDistFromCenter)+ screenCenter.y;
            let player2FromCenterX:number = Math.cos(playerAngle) * (this.player2SplitDistFromCenter)+ screenCenter.x;
            let player2FromCenterY:number = Math.sin(playerAngle) * (this.player2SplitDistFromCenter)+ screenCenter.y;
            
            //similar to before, to focus the map of each player we want to minus the player position to put then top left + plus half the screen width height + plus their position relative to the screen center
            let splitMapPos1:PIXI.Point = new Point(-player1Local.x + player1FromCenterX, -player1Local.y + player1FromCenterY);
            let splitMapPos2:PIXI.Point = new Point(-player2Local.x + player2FromCenterX, -player2Local.y + player2FromCenterY);
            
            //Im not totally happy with this bit but its as good as I got
            //if we just use the split map positions they didn't line up nicely when the maps merge
            //to get around this I use 50% (1 - 1.5) of the stretch calculation to ease the maps together
            //these offsets are the distance between the combined map center and the split distance
            //we can then use the a percentage of this offset to ease the maps together
            let splitOffset1:PIXI.Point = new Point(splitMapPos1.x - newMapPos1.x, splitMapPos1.y - newMapPos1.y);
            let splitOffset2:PIXI.Point = new Point(splitMapPos2.x - newMapPos2.x , splitMapPos2.y - newMapPos2.y);
            
            //this gives us a 0-1 for the stretchPercentage between 1 and 1.5 
            let tension:number = this.getPercentageFromRange( 1, 1.5, stretchPercentage);

            //since we have calculated the tension, we might as well alpha the middle line 
            this.splitLineGraphic.alpha = tension;

            //both maps always want to be in the center point between the two players
            //but between stretchPercentage 1 - 1.5 we gradually add the split offset to pull them apart
            //this allows the maps the merge and split "smoothly"
            //I'm sure someone with better maths skills could tell me a cleaner why to achieve this
            newMapPos1.x = newMapPos1.x + (splitOffset1.x * tension);
            newMapPos1.y = newMapPos1.y + (splitOffset1.y * tension);

            newMapPos2.x = newMapPos2.x + (splitOffset2.x * tension);
            newMapPos2.y = newMapPos2.y + (splitOffset2.y * tension);

            //we need to find the points for the split line
            let splitPoints:PIXI.Point[] = this.calcSplitPoints(player1Local,player2Local);
            this.drawsLineBetweenPlayers(splitPoints, tension);
            this.drawMapMaskAroundPlayer2(splitPoints);
        }

        
        //this is a quick check to make sure the final map positions don't reveal the edge of the map
        //it just checks the calculated map positions witht he screen boundary
        if(newMapPos1.x < -this.mapWidth+this.app.screen.width){
            newMapPos1.x = -this.mapWidth+this.app.screen.width;
        }
        if(newMapPos1.x > 0){
            newMapPos1.x = 0;
        }
        if(newMapPos1.y < -this.mapHeight+this.app.screen.height){
            newMapPos1.y = -this.mapHeight+this.app.screen.height;
        }
        if(newMapPos1.y > 0){
            newMapPos1.y = 0;
        }

        if(newMapPos2.x < -this.mapWidth+this.app.screen.width){
            newMapPos2.x = -this.mapWidth+this.app.screen.width;
        }
        if(newMapPos2.x > 0){
            newMapPos2.x = 0;
        }
        if(newMapPos2.y < -this.mapHeight+this.app.screen.height){
            newMapPos2.y = -this.mapHeight+this.app.screen.height;
        }
        if(newMapPos2.y > 0){
            newMapPos2.y = 0;
        }

        //and apply the calculated map positions to the map and player containers 
        this.mapContainer1.x = newMapPos1.x;
        this.mapContainer1.y = newMapPos1.y;
        this.playerContainer1.x = newMapPos1.x;
        this.playerContainer1.y = newMapPos1.y;
        
        this.mapContainer2.x = newMapPos2.x;
        this.mapContainer2.y = newMapPos2.y;
        this.playerContainer2.x = newMapPos2.x;
        this.playerContainer2.y = newMapPos2.y;
    }
    
    

    /**
     * returns the percentage 0 - 1 of a number within a range
     * @param min range minimum
     * @param max range maximum
     * @param num the number within the range
     */
    private getPercentageFromRange(min:number, max:number, num:number): number{
        let range:number = max - min;
        return Math.min( num - min, range ) * ( 1 / range );
    }
    
    

    /**
     * returns the distance between two provided points
     * @param a player 1 position
     * @param b player 2 position
     */
    private getDistance(a:PIXI.Point, b:PIXI.Point): number{
        let disX:number = b.x - a.x;
        let disY:number = b.y - a.y;		
        
        return Math.sqrt((disX*disX)+(disY*disY));
    }


    /**
     * returns the angle between two given points
     * @param a player 1 position
     * @param b player 2 position
     */
    private getAngle(a:PIXI.Point, b:PIXI.Point): number {
        let disX:number = b.x - a.x;
        let disY:number = b.y - a.y;	

        return Math.atan2(disY,disX);
    }


    /**
     * returns the points where the split line intersects the side of the screen, in the order top,right,bottom,left
     * only two of the points will be valid top-bottom or left-right
     * @param a player 1 position
     * @param b player 2 position
     */
    private calcSplitPoints(a:PIXI.Point, b:PIXI.Point):PIXI.Point[] {
        let angle:number = this.getAngle(a,b);
        let midpoint:PIXI.Point = new PIXI.Point(this.app.screen.width * .5, this.app.screen.height * .5);

        //calculates a large line between the players which always runs through the screen center 
        let splitStartX:number = Math.sin(angle) * 1000 + midpoint.x;
        let splitStartY:number = -Math.cos(angle) * 1000 + midpoint.y;
        let splitEndX:number = -Math.sin(angle) * 1000 + midpoint.x;
        let splitEndY:number = Math.cos(angle) * 1000 + midpoint.y;
        
        //find where the line intersects the side of the screen, it should only fined two valid points top-bottom or left-right
        let top:PIXI.Point = this.getLineIntersection(splitStartX, splitStartY, splitEndX, splitEndY, 0, 0, this.app.screen.width, 0);
        let right:PIXI.Point = this.getLineIntersection(splitStartX, splitStartY, splitEndX, splitEndY, this.app.screen.width, 0, this.app.screen.width, this.app.screen.height);
        let bottom:PIXI.Point = this.getLineIntersection(splitStartX, splitStartY, splitEndX, splitEndY, 0, this.app.screen.height, this.app.screen.width, this.app.screen.height);
        let left:PIXI.Point = this.getLineIntersection(splitStartX, splitStartY, splitEndX, splitEndY, 0, 0, 0, this.app.screen.height);
        
        return [top,right,bottom,left];
    }

    /**
     * draws a line between the two players
     * @param splitPoints points where the split line intersects the side of the screen, in the order top,right,bottom,left
     * @param alpha the line alpha
     */
    private drawsLineBetweenPlayers(splitPoints:PIXI.Point[], alpha:number){
        let top:PIXI.Point = splitPoints[0];
        let right:PIXI.Point = splitPoints[1];
        let bottom:PIXI.Point = splitPoints[2];
        let left:PIXI.Point  = splitPoints[3];

        this.splitLineGraphic.clear();
        this.splitLineGraphic.lineStyle(this.lineWidth, this.lineColor, alpha);
        
        if(right && left){
            this.splitLineGraphic.moveTo(right.x,right.y);
            this.splitLineGraphic.lineTo(left.x,left.y);

        }else if(top && bottom){
            this.splitLineGraphic.moveTo(top.x,top.y);
            this.splitLineGraphic.lineTo(bottom.x,bottom.y);
        }
    }
    
    /**
     * draws a mask around the player 2
     * @param splitPoints points where the split line intersects the side of the screen, in the order top,right,bottom,left
     */
    private drawMapMaskAroundPlayer2(splitPoints:PIXI.Point[]){
        let top:PIXI.Point = splitPoints[0];
        let right:PIXI.Point = splitPoints[1];
        let bottom:PIXI.Point = splitPoints[2];
        let left:PIXI.Point  = splitPoints[3];

        let cornerpt1:PIXI.Point;
        let cornerpt2:PIXI.Point;
        
        let player1Global:PIXI.Point =  new PIXI.Point(this.player1.getGlobalPosition().x, this.player1.getGlobalPosition().y);
        let player2Global:PIXI.Point =  new PIXI.Point(this.player2.getGlobalPosition().x, this.player2.getGlobalPosition().y);
        
        if(right && left){
            if(player1Global.y > player2Global.y){
                cornerpt1 = new PIXI.Point(0,0);
                cornerpt2 = new PIXI.Point(this.app.screen.width,0);
            }else{
                cornerpt1 = new PIXI.Point(0,this.app.screen.height);
                cornerpt2 = new PIXI.Point(this.app.screen.width,this.app.screen.height);
            }
        }else if(top && bottom){
            if(player1Global.x > player2Global.x){
                cornerpt1 = new PIXI.Point(0,0);
                cornerpt2 = new PIXI.Point(0,this.app.screen.height);
            }else{
                cornerpt1 = new PIXI.Point(this.app.screen.width,0);
                cornerpt2 = new PIXI.Point(this.app.screen.width,this.app.screen.height);
            }
        }
        
        this.mapContainer2Mask.clear();
        this.mapContainer2Mask.beginFill(0xFF3300);
        this.mapContainer2Mask.moveTo(cornerpt1.x,cornerpt1.y);
        if(top) this.mapContainer2Mask.lineTo(top.x,top.y);
        if(bottom) this.mapContainer2Mask.lineTo(bottom.x,bottom.y);
        if(left) this.mapContainer2Mask.lineTo(left.x,left.y);
        if(right) this.mapContainer2Mask.lineTo(right.x,right.y);
        this.mapContainer2Mask.lineTo(cornerpt2.x,cornerpt2.y);
        this.mapContainer2Mask.lineTo(cornerpt1.x,cornerpt1.y);
        this.mapContainer2Mask.endFill();  
    };


    /**
     * This function returns the point where two lines intersect
     * returns null if no intersection found
     * full credit to: http://jsfiddle.net/justin_c_rounds/Gd2S2/light/
     * 
     * @param line1StartX line 1 start x
     * @param line1StartY line 1 start y
     * @param line1EndX line 1 end x
     * @param line1EndY line 1 end y
     * @param line2StartX line 2 start x
     * @param line2StartY line 2 start y
     * @param line2EndX line 2 end x
     * @param line2EndY line 2 end y
     */
    private getLineIntersection(line1StartX:number, line1StartY:number, line1EndX:number, line1EndY:number, line2StartX:number, line2StartY:number, line2EndX:number, line2EndY:number):PIXI.Point {
        let denominator:number = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
        if (denominator == 0) {
            return null;
        }

        let a:number = line1StartY - line2StartY;
        let b:number = line1StartX - line2StartX;
        let numerator1:number = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
        let numerator2:number = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
        a = numerator1 / denominator;
        b = numerator2 / denominator;

        //if a and b are between 0-1 then both line intersect and return point
        if ((a > 0 && a < 1) && (b > 0 && b < 1)) {
            let result:PIXI.Point = new PIXI.Point(0,0);
            result.x = line1StartX + (a * (line1EndX - line1StartX));
            result.y = line1StartY + (a * (line1EndY - line1StartY));
            return result;
        }

        return null;
    }
}