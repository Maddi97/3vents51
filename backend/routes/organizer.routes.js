var express = require('express');
var router = express.Router();
const Organizer = require("../model/organizer.model")
const Event = require("../model/event.model")
const auth = require("../middleware/authJWT");
const limiter = require("../middleware/rateLimiter")

router.get('/organizer', limiter, (req, res) => {
    Organizer.find({})
        .then(organizer => res.send(organizer))
        .catch(error => console.log(error))
});

router.post('/organizer', limiter, auth, (req, res) => {
    (new Organizer(req.body.organizer))
        .save()
        .then((organizer) => res.send(organizer))
        .catch((error) => console.log(error))
});

router.post('/organizerByEventCategory', limiter, (req, res) => {
    let orgs = []
    let catId = req.body.category._id
    Organizer.find(
        {}).then((organizers) => {
            Event.find({ 'category._id': catId }).then(
                (events) => {
                    organizers.map(o => {
                        events.map(ev => {
                            if (ev._organizerId.toString().trim() === o._id.toString().trim()) {
                                if (!orgs.includes(o)) {
                                    orgs.push(o)
                                }
                            }
                        })
                    }
                    )
                    return res.send(orgs)

                }
            ).catch((error) => console.log(error))

        }).catch((error) => console.log(error))
        ;

})

router.get('/organizer/:organizerId', limiter, (req, res) => {
    Organizer.find({ _id: req.params.organizerId })
        .then((organizer) => res.send(organizer))
        .catch((error) => console.log(error))
})


router.patch('/organizer/:organizerId', limiter, auth, (req, res) => {
    const id = req.params.organizerId;
    const organizer = req.body.organizer;
    Organizer.findByIdAndUpdate({ _id: id }, { $set: organizer })
        .then((organizer) => res.send(organizer))
        .catch((error => console.log(error)))
});

router.delete('/organizer/:organizerId', limiter, auth, (req, res) => {
    Organizer.findByIdAndDelete({ _id: req.params.organizerId })
        .then((organizer) => res.send(organizer))
        .catch((error => console.log(error)))
});

module.exports = router
