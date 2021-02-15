import { useRef, useEffect, useState } from "react";
import { deserialiseStrokes, getRandInRange } from "./util";
import Canvas from "./Canvas";

interface RandPicCache {
  [key: string]: any;
}

export const logo = deserialiseStrokes(
  JSON.parse(
    '[["#d33115",4,300,"[[59,73],[59,82],[57,95],[56,111],[56,113]]"],["#d33115",4,300,"[[61,71],[70,64],[78,64],[89,71],[89,79],[84,87],[76,91],[66,90],[62,87]]"],["#e27300",4,300,"[[146,66],[132,67],[125,68],[119,69],[114,70]]"],["#e27300",4,300,"[[129,74],[127,89],[126,97],[126,103],[126,107],[126,109]]"],["#e27300",4,300,"[[139,111],[124,111],[118,111],[114,110],[112,110]]"],["#fcc400",4,300,"[[183,66],[171,71],[163,83],[162,90],[163,98],[168,103],[175,106],[182,107],[186,108]]"],["#68bc00",4,300,"[[239,65],[219,66],[213,66],[209,66],[206,68]]"],["#68bc00",4,300,"[[223,70],[223,80],[222,90],[222,101],[222,112]]"],["#16a5a5",3,300,"[[77,168],[64,173],[59,180],[56,187],[54,194],[53,201],[53,206],[54,210],[58,211],[63,208],[69,203],[74,198],[76,194],[78,197],[78,202],[78,206],[78,209]]"],["#16a5a5",3,300,"[[93,188],[80,191],[75,191],[71,191],[67,190],[65,189]]"],["#009ce0",3,300,"[[101,210],[106,198],[111,191],[115,183],[117,177],[119,172],[120,170],[121,168],[122,166]]"],["#009ce0",3,300,"[[123,167],[127,175],[130,183],[133,191],[135,199],[137,209],[138,211],[137,208]]"],["#009ce0",3,300,"[[134,193],[122,192],[117,193],[114,193],[110,194]]"],["#7b64ff",3,300,"[[164,171],[162,190],[161,202],[161,206],[160,208],[161,206],[162,201],[163,194],[164,186],[165,179],[167,173],[168,169],[171,169],[173,174],[175,181],[176,189],[176,194],[176,197],[176,194],[177,188],[179,181],[182,174],[185,169],[187,168],[189,170],[190,176],[192,186],[193,195],[194,202],[194,206]]"],["#fa28ff",3,300,"[[232,165],[223,165],[221,165],[219,167],[218,169],[218,172],[217,178],[217,184],[216,189],[216,194],[216,198],[216,200],[215,203],[214,205],[219,205],[224,203],[228,203],[231,202],[233,202]]"],["#fa28ff",3,300,"[[234,185],[224,185],[220,184],[217,184]]"],["#000000",2,300,"[[145,254]]"],["#000000",2,300,"[[145,265]]"],["#000000",2,300,"[[156,246],[162,253],[163,255],[163,258],[163,261],[160,268],[158,270],[156,272],[155,273]]"]]'
  )
);

const LogoWrapper = (props: any) => {
  const { darkMode, deviceIsSmall } = props;
  const [animDone, setAnimDone] = useState(false);
  const [pic, setPic] = useState(logo);
  const randPicCache = useRef({} as RandPicCache);
  const totalPicCount = useRef(100);
  const logoTimer = useRef(0);

  useEffect(() => {
    if (animDone) {
      const keys = Object.keys(randPicCache.current);
      const fetchRandPic =
        keys.length < Math.min(totalPicCount.current, 5) // limit to <=5 unique pics
          ? () =>
              fetch("https://api.siidhee.sh/randpic")
                .then((res) => res.json())
                .then((data) => {
                  if (data.pic && data.name) {
                    randPicCache.current[data.name] = data.pic;
                    totalPicCount.current = data.count;
                    try {
                      return Promise.resolve(deserialiseStrokes(data.pic));
                    } catch (e) {
                      //debug(e, data);
                      return Promise.reject(e);
                    }
                    //setAnimDone(false); // animate pic
                  } else return Promise.reject();
                })
          : () => {
              const getNext = () =>
                randPicCache.current[keys[getRandInRange(0, keys.length - 1)]];
              /*let nextPic = getNext();
              if (keys.length > 1) {
                while (pic === nextPic) nextPic = getNext();
              }*/
              try {
                return Promise.resolve(deserialiseStrokes(getNext()));
              } catch (e) {
                //debug(e, nextPic);
                return Promise.reject(e);
              }
              //setAnimDone(false);
            };
      logoTimer.current = window.setTimeout(
        () => {
          pic === logo
            ? fetchRandPic()
                .then(setPic)
                .catch(() => setPic(logo))
            : setPic(logo);
        },
        pic === logo ? 1500 : 3000
      );
      return () => window.clearTimeout(logoTimer.current);
    }
  }, [animDone, pic]);

  return (
    <div
      style={{
        margin: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "20px",
        //border: "red dashed",
      }}
    >
      <div
        style={{
          marginBottom: "30px",
        }}
      >
        <Canvas
          displayedHistory={pic}
          size={deviceIsSmall ? 200 : 300}
          animated={!animDone}
          onAnimDone={() => setAnimDone(true)} // setting animDone to false starts the effect above
          bgColour={darkMode && pic === logo ? "#424242" : "#fff"}
          locked
        />
      </div>
      {props.children}
    </div>
  );
};

export default LogoWrapper;
