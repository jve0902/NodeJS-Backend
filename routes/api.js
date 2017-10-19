var moduleNews = require('../models/news');
var express = require('express');
var router = express.Router();
var promise = require('bluebird');
var auth = require('../config/auth');
var mongoose = require('mongoose');

mongoose.Promise = promise;

var MAX_LIMIT = 12;

var createSlug = function (title) {
    return title;
};

router.route('/news')
    //this route will get the data from the data base and respond to the request with required fields
    .get(function (req, res) {
        var page = req.query.page | 1;    //gets the query from the request
        var source = req.query.source;
        if (source) {
            //moduleNews.News.find({source: source}).limit(max_limit).skip(page * max_limit);
            moduleNews.News
                .find({published: true, deleted:false, source: source})
                .sort({createdAt: -1})
                .limit(MAX_LIMIT)
                //.skip(page - 1 * MAX_LIMIT)
                .exec()
                .then(function(result){
                    if (result) {

                        res.status(200).json(result);
                    }else
                        res.status(400).json({
                            error: 'Internal server error'
                        });
                })
                .catch(function (err) {
                });
        } else {
            res.status(404).json({
                error: 'Source not provided'
            });
        }
    })
    //this route will post the json data generated by python to the database
    //add auth.isAuth middleware once done testing post request locally
    .post(function (req, res) {
        //The res.user checks if the user is making the request. If not then the else statement is executed
        // if (!req.user) {
        //     res.status(401).json({
        //         error: 'Unauthorized'
        //     });
        // } else
        if (req.body.title && req.body.source) {
            var params = {};
            params.title = req.body.title;
            params.source = req.body.source;
            if (req.body.cover) params.cover = req.body.cover;
            if (req.body.article) params.article = req.body.article;
            params.slug = createSlug(params.title);
            params.published = true;
            params.deleted = false;

            var news = new moduleNews.News(params);
            news.save(function (err) {
                if (err)
                    res.status(400).json({
                        error: 'Internal server error'
                    });
                else
                    res.status(201).json({
                        msg: 'Item created successfully'
                    });
            });
        } else {
            res.status(401).json({
                error: 'All information not provided'
            });
        }
    })
    .delete(auth.isAuth, function (req, res){
        res.sendStatus();
    });

router.route('/news/:id')
    .get(function (req, res) {
        res.send({news: []});
    })
    .post(function (req, res) {
        res.sendStatus(201);
    });

module.exports = router;
