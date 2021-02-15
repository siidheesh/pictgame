import { Button, Dialog, Typography } from "@material-ui/core";
import React from "react";

const UserOffline = React.memo((props: any) => (
  <Dialog open={props.open} aria-labelledby="" aria-describedby="">
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        margin: "20px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <Typography variant="h6">Lost connection with server!</Typography>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Button onClick={props.onSinglePlayer}>Single-player mode</Button>
        <Button onClick={props.onQuit}>Quit</Button>
      </div>
    </div>
  </Dialog>
));

export default UserOffline;
