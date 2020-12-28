import React, { useState, useRef, useEffect } from "react";

function Home(props: any) {

    const ROOM_ID_SS_KEY = "roomId";

    const [roomId, setRoomId] = useState(window.sessionStorage.getItem(ROOM_ID_SS_KEY));
    
    useEffect(() => {
        window.sessionStorage.setItem(ROOM_ID_SS_KEY, roomId ?? "");
    }, [roomId]);

    return (
        <div className="Home">
            <h1>Home</h1>
            <p>Create game</p>
            <p>Or Join room: {roomId}</p>
        </div>
    );
};

export default Home;