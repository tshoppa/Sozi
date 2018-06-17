/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

import {SVGDocumentWrapper} from "./svg/SVGDocumentWrapper";
import {VideoDocumentWrapper} from "./svg/VideoDocumentWrapper";
import {Presentation} from "./model/Presentation";
import {Viewport} from "./player/Viewport";
import {Player} from "./player/Player";
import * as Media from "./player/Media";
import * as FrameList from "./player/FrameList";
import * as FrameNumber from "./player/FrameNumber";
import * as FrameURL from "./player/FrameURL";

window.addEventListener("load", function () {
    const svgRoot = document.querySelector("svg");
    const videoRoot = document.querySelector("video");
    svgRoot.style.display = "inline";
    // svgRoot.style.display = "absolute"; ??
    console.log("player window addEventListener", videoRoot);

    SVGDocumentWrapper.init(svgRoot);
    VideoDocumentWrapper.init(videoRoot);
    Presentation.init().setSVGDocument(SVGDocumentWrapper).setVideoDocument(VideoDocumentWrapper);
    Viewport.init(Presentation, false).onLoad();

    Presentation.fromStorable(window.soziPresentationData);
    Player.init(Viewport, Presentation);

    Media.init(Player);
    FrameList.init(Player);
    FrameNumber.init(Player);
    FrameURL.init(Player);

    window.sozi = {
        presentation: Presentation,
        viewport: Viewport,
        player: Player
    };

    Player.addListener("stateChange", () => {
        if (Player.playing) {
            document.title = Presentation.title;
        }
        else {
            document.title = Presentation.title + " (Paused)";
        }
    });

    window.addEventListener('resize', () => Viewport.repaint());

    if (Presentation.frames.length) {
        Player.playFromFrame(FrameURL.getFrame());
    }

    Viewport.repaint();
    Player.disableBlankScreen();

    document.querySelector(".sozi-blank-screen .spinner").style.display = "none";
    if(window.sozi.presentation.video){
        document.querySelector("#sozi-video").style.display = "block";
        document.querySelector("#sozi-video").style.position = "absolute";
        document.querySelector("#sozi-video").style.width = window.sozi.presentation.videoWidth+"px";
        document.querySelector("#sozi-video").style.height = window.sozi.presentation.videoHeight+"px";
        if(window.sozi.presentation.videoPosition == '0'){
            document.querySelector("#sozi-video").style.top = "0px";
            document.querySelector("#sozi-video").style.left = "0px";
        }
        if(window.sozi.presentation.videoPosition == '1'){
            document.querySelector("#sozi-video").style.top = "0px";
            document.querySelector("#sozi-video").style.left = "0px";
        }
        if(window.sozi.presentation.videoPosition == '2'){
            document.querySelector("#sozi-video").style.bottom = "0px";
            document.querySelector("#sozi-video").style.right = "0px";
        }
        if(window.sozi.presentation.videoPosition == '3'){
            document.querySelector("#sozi-video").style.bottom = "0px";
            document.querySelector("#sozi-video").style.right = "0px";
        }
    }
});
